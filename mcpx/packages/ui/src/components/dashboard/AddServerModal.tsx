import {
  getMcpColorByName,
  MCP_SERVER_EXAMPLES,
} from "@/components/dashboard/constants";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";
import { useAddMcpServer } from "@/data/mcp-server";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useSocketStore } from "@/store";
import {
  handleMultipleServers,
  validateAndProcessServer,
  validateServerCommand,
  validateServerName,
} from "@/utils/server-helpers";
import { mcpJsonSchema, serverNameSchema } from "@/utils/mcpJson";
import { AxiosError } from "axios";
import { Theme as EmojiPickerTheme } from "emoji-picker-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod/v4";
import { McpJsonForm } from "./McpJsonForm";
import {
  CustomTabs,
  CustomTabsContent,
  CustomTabsList,
  CustomTabsTrigger,
} from "@/components/ui/custom-tabs";
import { JsonUpload } from "@/components/ui/json-upload";
import { Separator } from "@/components/ui/separator";
import { editor } from "monaco-editor";
import { Input } from "../ui/input";
import { ServerCard } from "./ServerCard";
import { isIconExists } from "@/hooks/useDomainIcon";

const DEFAULT_SERVER_NAME = "my-server";
const DEFAULT_SERVER_COMMAND = "my-command";
const DEFAULT_SERVER_ARGS = "--arg-key arg-value";
const DEFAULT_ENVIRONMENT_VARIABLES = {
  MY_ENV_VAR: "my-env-value",
} as const;
const DEFAULT_SERVER_CONFIGURATION_JSON = JSON.stringify(
  {
    [DEFAULT_SERVER_NAME]: {
      command: DEFAULT_SERVER_COMMAND,
      args: DEFAULT_SERVER_ARGS.split(" "),
      env: DEFAULT_ENVIRONMENT_VARIABLES,
    },
  },
  null,
  2,
);

const getServerExistsError = (name: string) =>
  `Server with name "${name}" already exists. Please choose a different name.`;

const getDefaultServerNameError = () =>
  `Server name cannot be "${DEFAULT_SERVER_NAME}". Please choose a different name.`;

const getDefaultCommandError = () =>
  `Command cannot be "${DEFAULT_SERVER_COMMAND}". Please provide a valid command.`;

/**
 * Detects and extracts nested server configurations using heuristics.
 * Handles formats like:
 * - { "mcpServers": { "server1": {}, "server2": {} } }
 * - { "servers": { "server1": {}, "server2": {} } }
 * - { "my-servers": { "server1": {}, "server2": {} } } (heuristic: single top-level key)
 *
 * Note: The single-key heuristic is just that - a heuristic. It's valid to have
 * multiple top-level keys like { "mcpServers": {...}, "otherConfig": {...} }
 */
const extractServerConfig = (
  parsed: Record<string, unknown>,
): Record<string, unknown> => {
  if (typeof parsed !== "object" || parsed === null) {
    return parsed;
  }

  // First, check for known wrapper keys (not heuristic)
  if (
    "mcpServers" in parsed &&
    typeof parsed.mcpServers === "object" &&
    parsed.mcpServers !== null
  ) {
    return parsed.mcpServers as Record<string, unknown>;
  }
  if (
    "servers" in parsed &&
    typeof parsed.servers === "object" &&
    parsed.servers !== null
  ) {
    return parsed.servers as Record<string, unknown>;
  }

  // Heuristic: if there's a single top-level key with an object value that contains server definitions
  const keys = Object.keys(parsed);
  if (keys.length === 1) {
    const topLevelKey = keys[0];
    const topLevelValue = parsed[topLevelKey];

    // If the value is an object with server-like keys, extract it
    if (typeof topLevelValue === "object" && topLevelValue !== null) {
      const nestedKeys = Object.keys(topLevelValue);
      // Check if nested keys look like server names (at least one valid server name)
      const hasServerLikeKeys = nestedKeys.some((key) => {
        const result = serverNameSchema.safeParse(key);
        return result.success;
      });

      if (hasServerLikeKeys) {
        return topLevelValue as Record<string, unknown>;
      }
    }
  }

  // Return original if no nested format detected
  return parsed;
};

type TabValue = "all" | "custom" | "migrate";

const TABS = {
  ALL: "all" as const,
  CUSTOM: "custom" as const,
  MIGRATE: "migrate" as const,
} as const;

export const AddServerModal = ({ onClose }: { onClose: () => void }) => {
  const systemState = useSocketStore((s) => s.systemState);
  const { mutate: addServer, isPending, error } = useAddMcpServer();

  const [name, setName] = useState(DEFAULT_SERVER_NAME);

  const [search, setSearch] = useState("");

  const [isIconPickerOpen, setIconPickerOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [customJsonContent, setCustomJsonContent] = useState(
    DEFAULT_SERVER_CONFIGURATION_JSON,
  );
  const [migrateJsonContent, setMigrateJsonContent] = useState("");
  const [hasUploadedFile, setHasUploadedFile] = useState(false);
  const [selectedExample, setSelectedExample] = useState<string>("memory");
  const [activeTab, setActiveTab] = useState<TabValue>(TABS.ALL);
  const colorScheme = useColorScheme();
  const emojiPickerTheme = useMemo<EmojiPickerTheme>(
    () => EmojiPickerTheme.LIGHT,
    [colorScheme],
  );

  // Tab-aware isDirty calculation - only checks the current tab's content
  const isDirty = useMemo(() => {
    if (activeTab === TABS.CUSTOM) {
      return (
        customJsonContent.replaceAll(/\s/g, "").trim() !==
        DEFAULT_SERVER_CONFIGURATION_JSON.replaceAll(/\s/g, "").trim()
      );
    }
    if (activeTab === TABS.MIGRATE) {
      return migrateJsonContent.trim() !== "" || hasUploadedFile;
    }
    return false;
  }, [activeTab, customJsonContent, migrateJsonContent, hasUploadedFile]);
  const [isValid, setIsValid] = useState(true);
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const showError = (message: string) => {
    setErrorMessage(message);
  };

  useEffect(() => {
    if (!error) return;

    const message =
      error instanceof AxiosError && error.response?.data?.msg
        ? error.response.data.msg
        : "Failed to add server. Please try again.";

    showError(message);
  }, [error]);

  function getServerStatus(
    name: string,
  ): "connected" | "pending-auth" | "connection-failed" | undefined {
    const server = systemState?.targetServers_new.find(
      (s) => s.name.toLowerCase() === name.toLowerCase(),
    );

    if (!server) {
      return undefined;
    }

    const statusType = server.state.type;

    // Return status type if it matches expected values, otherwise undefined
    if (
      statusType === "connected" ||
      statusType === "pending-auth" ||
      statusType === "connection-failed"
    ) {
      return statusType;
    }

    return undefined;
  }

  const handleAddServer = (name: string, jsonContent: string) => {
    // Parse JSON to check if it contains multiple servers
    let parsedJson;
    try {
      parsedJson = JSON.parse(jsonContent);
    } catch (e) {
      showError("Invalid JSON format");
      return;
    }

    // Check if this is a multi-server configuration (from migrate tab)
    const serversObject = parsedJson.mcpServers || parsedJson;
    const serverNames = Object.keys(serversObject);

    // If multiple servers detected, handle them in parallel
    if (serverNames.length > 1) {
      handleMultipleServersUpload(serversObject, serverNames);
      return;
    }

    // Single server handling - reconstruct JSON if it was wrapped in mcpServers
    const actualServerName = serverNames[0];
    const singleServerJson = parsedJson.mcpServers
      ? JSON.stringify(
          { [actualServerName]: serversObject[actualServerName] },
          null,
          2,
        )
      : jsonContent;

    const result = validateAndProcessServer({
      jsonContent: singleServerJson,
      icon: isIconExists(actualServerName)
        ? undefined
        : getMcpColorByName(actualServerName),
      existingServers: systemState?.targetServers_new || [],
      isEdit: false,
    });

    if (result.success === false) {
      showError(result.error || "Failed to add server. Please try again.");
      return;
    }

    const nameError = validateServerName(actualServerName);

    if (nameError) {
      showError(nameError);
      return;
    }

    const commandError = validateServerCommand(result.payload);
    if (commandError) {
      showError(commandError);
      return;
    }

    // Update the JSON content to include the type
    if (result.updatedJsonContent) {
      setCustomJsonContent(result.updatedJsonContent);
    }

    addServer(
      {
        payload: result.payload,
      },
      {
        onSuccess: (server: { name: string }) => {
          toast({
            description: (
              <>
                Server{" "}
                <strong>
                  {server.name.charAt(0).toUpperCase() + server.name.slice(1)}
                </strong>{" "}
                was added successfully.
              </>
            ),
            title: "Server Added",
            duration: 4000,
            isClosable: true,
            variant: "server-info",
            position: "bottom-left",
            domain: server.name, // Pass server name as domain for icon
          });
          // Reset form state before closing
          resetFormState();
          // Close the modal - the system state will be updated via socket
          onClose();
        },
        onError: (error) => {
          console.warn("Error adding server:", error);
        },
      },
    );
  };

  const handleMultipleServersUpload = async (
    serversObject: Record<string, unknown>,
    serverNames: string[],
  ) => {
    const result = await handleMultipleServers({
      serversObject,
      serverNames,
      existingServers: systemState?.targetServers_new || [],
      getIcon: (serverName) =>
        isIconExists(serverName) ? undefined : getMcpColorByName(serverName),
      addServer,
    });

    const { successfulServers, failedServers } = result;

    // Show summary toast
    if (successfulServers.length > 0) {
      toast({
        description: (
          <>
            Successfully added <strong>{successfulServers.length}</strong>{" "}
            server{successfulServers.length > 1 ? "s" : ""}.
            {failedServers.length > 0 &&
              ` Failed to add: ${failedServers.join(", ")}`}
          </>
        ),
        title:
          failedServers.length > 0
            ? "Servers Added (with errors)"
            : "Servers Added",
        duration: 5000,
        isClosable: true,
        variant: failedServers.length > 0 ? "warning" : "server-info",
        position: "bottom-left",
      });
      resetFormState();
      onClose();
    } else {
      showError(`Failed to add all servers: ${failedServers.join(", ")}`);
    }
  };

  const handleJsonChange = useCallback(
    (value: string) => {
      setCustomJsonContent(() => value);
      if (errorMessage.length > 0) {
        showError("");
      }
      if (!value || value === DEFAULT_SERVER_CONFIGURATION_JSON) return;
      try {
        const parsed = JSON.parse(value);
        const keys = Object.keys(parsed);
        const result = serverNameSchema.safeParse(keys[0]);
        if (result.success) {
          setName(result.data);
        } else {
          setName("");
        }
      } catch (e) {
        console.warn("Invalid JSON format:", e);
        setName("");
      }
    },
    [errorMessage],
  );

  const handleMigrateJsonChange = useCallback(
    (value: string) => {
      setMigrateJsonContent(value);
      if (errorMessage.length > 0) {
        showError("");
      }
      try {
        const parsed = JSON.parse(value);
        // Extract server config (handles nested formats)
        const serverConfig = extractServerConfig(parsed);
        const keys = Object.keys(serverConfig);

        // Validate all server names using safeParse
        const validServerNames = keys.filter((key) => {
          const result = serverNameSchema.safeParse(key);
          return result.success;
        });

        if (validServerNames.length === 0) {
          setName("");
          return;
        }

        // Use first server name for display purposes (when multiple servers, we'll add all)
        setName(validServerNames[0]);
      } catch (e) {
        console.warn("Invalid JSON format:", e);
        setName("");
      }
    },
    [errorMessage],
  );

  const handleMigrateFileUpload = useCallback(() => {
    setHasUploadedFile(true);
  }, []);

  // Reset all form state to initial values
  const resetFormState = useCallback(() => {
    setName(DEFAULT_SERVER_NAME);
    setCustomJsonContent(DEFAULT_SERVER_CONFIGURATION_JSON);
    setMigrateJsonContent("");
    setHasUploadedFile(false);
    setErrorMessage("");
    setIsValid(true);
    setSearch("");
    setActiveTab(TABS.ALL);
  }, []);

  const handleClose = useCallback(() => {
    if (!isDirty) {
      resetFormState();
      onClose?.();
    } else {
      // Show warning toast instead of browser confirm dialog
      const warningToast = toastRef.current({
        title: "Unsaved Changes",
        description:
          "Changes you made have not been saved. Are you sure you want to close?",
        variant: "warning",
        duration: 1000000, // Long duration to prevent auto-dismiss
        action: (
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              warningToast.dismiss(); // Dismiss the toast when OK is clicked
              resetFormState();
              onClose?.();
            }}
          >
            OK
          </Button>
        ),
        position: "bottom-left",
      });
    }
  }, [isDirty, onClose, resetFormState]);

  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        if (!isDirty) {
          resetFormState();
          onClose?.();
        } else {
          const warningToast = toastRef.current({
            title: "Unsaved Changes",
            description:
              "Changes you made have not been saved. Are you sure you want to close?",
            variant: "warning",
            duration: 1000000,
            action: (
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  warningToast.dismiss();
                  resetFormState();
                  onClose?.();
                }}
              >
                OK
              </Button>
            ),
            position: "bottom-left",
          });
        }
      }
    },
    [isDirty, onClose, resetFormState],
  );

  const handleUseExample = (
    config: Record<string, unknown>,
    serverName: string,
    withEnvs?: boolean,
  ) => {
    const newJsonContent = JSON.stringify(config, null, 2);
    setCustomJsonContent(newJsonContent);
    setName(serverName);

    if (!withEnvs) {
      handleAddServer(serverName, newJsonContent);
      return;
    }
    setActiveTab(TABS.CUSTOM);
  };

  const handleValidate = useCallback((markers: editor.IMarker[]) => {
    setIsValid(markers.length === 0);
  }, []);

  return (
    <Dialog open onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-[1560px] max-h-[90vh+40px] flex flex-col bg-white border border-[var(--color-border-primary)] rounded-lg">
        <div className="text-2xl font-semibold">Add Server</div>
        <hr />
        <div className="flex flex-col ">
          <div>
            <CustomTabs
              value={activeTab}
              onValueChange={(value: string) => {
                const newTab = value as TabValue;
                if (activeTab === TABS.MIGRATE && newTab !== TABS.MIGRATE) {
                  setHasUploadedFile(false);
                }
                setActiveTab(newTab);
              }}
            >
              <CustomTabsList>
                <CustomTabsTrigger value={TABS.ALL}>All</CustomTabsTrigger>
                <CustomTabsTrigger value={TABS.CUSTOM}>
                  Custom
                </CustomTabsTrigger>
                <CustomTabsTrigger value={TABS.MIGRATE}>
                  Migrate
                </CustomTabsTrigger>
              </CustomTabsList>
              {activeTab === TABS.ALL && (
                <div className="my-4">
                  <div className="my-4 text-sm">
                    Select server to add to your configuration
                  </div>
                  <div>
                    <Input
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search..."
                    />
                  </div>
                </div>
              )}

              {activeTab === TABS.CUSTOM && (
                <div className="my-4 text-sm">
                  Add the server to your configuration by pasting your server's
                  JSON configuration below.
                </div>
              )}
              <CustomTabsContent value={TABS.ALL}>
                <div className="flex gap-4 bg-white flex-wrap overflow-y-auto min-h-[calc(70vh-40px)] max-h-[calc(70vh-40px)]">
                  {MCP_SERVER_EXAMPLES.filter((example) =>
                    example.label.toLowerCase().includes(search.toLowerCase()),
                  ).map((example) => (
                    <ServerCard
                      key={example.value}
                      server={example}
                      status={getServerStatus(example.value)}
                      className="w-[calc(25%-1rem)] max-h-[260px]"
                      onAddServer={handleUseExample}
                    />
                  ))}
                </div>
              </CustomTabsContent>
              <CustomTabsContent value={TABS.CUSTOM}>
                <McpJsonForm
                  colorScheme={colorScheme}
                  errorMessage={errorMessage}
                  onValidate={handleValidate}
                  onChange={handleJsonChange}
                  placeholder={DEFAULT_SERVER_CONFIGURATION_JSON}
                  schema={z.toJSONSchema(mcpJsonSchema)}
                  value={customJsonContent}
                />
                <Separator className="my-4" />
              </CustomTabsContent>
              <CustomTabsContent value={TABS.MIGRATE}>
                <div className="my-4">
                  <div className="my-4 text-sm">
                    Add servers to your configuration by pasting your JSON
                    configuration below or upload file.
                  </div>
                  <JsonUpload
                    value={migrateJsonContent}
                    onChange={handleMigrateJsonChange}
                    onFileUpload={handleMigrateFileUpload}
                    onValidate={handleValidate}
                    height="400px"
                  />
                  {errorMessage && (
                    <div className="mb-3 p-2 bg-[var(--color-bg-danger)] border border-[var(--color-border-danger)] rounded-md">
                      <p className="inline-flex items-center gap-1 px-2 py-0.5 font-medium text-sm text-[var(--color-fg-danger)]">
                        {errorMessage}
                      </p>
                    </div>
                  )}
                </div>
                <Separator className="my-4" />
              </CustomTabsContent>
            </CustomTabs>
          </div>
        </div>

        {isPending && (
          <div className="px-6 flex-shrink-0">
            <div className="space-y-2">
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-[var(--color-bg-container-secondary)] animate-pulse">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[var(--color-fg-interactive)] to-transparent animate-[shimmer_2s_ease-in-out_infinite]" />
                <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-fg-interactive)] via-transparent to-[var(--color-fg-interactive)] animate-[shimmer_1.5s_ease-in-out_infinite_reverse]" />
              </div>
            </div>
          </div>
        )}

        {(activeTab === TABS.CUSTOM || activeTab === TABS.MIGRATE) && (
          <div className="w-full flex justify-between -mt-6">
            {handleClose && (
              <Button
                onClick={handleClose}
                className="text-component-primary"
                variant="ghost"
                type="button"
              >
                Cancel
              </Button>
            )}
            <Button
              disabled={
                isPending ||
                !isDirty ||
                (activeTab !== TABS.CUSTOM && activeTab !== TABS.MIGRATE) ||
                !isValid
              }
              onClick={() => {
                // Both CUSTOM and MIGRATE tabs use the same handler
                // handleAddServer automatically detects single vs multiple servers
                const jsonContent =
                  activeTab === TABS.CUSTOM
                    ? customJsonContent
                    : migrateJsonContent;
                handleAddServer(name, jsonContent);
              }}
            >
              {isPending ? (
                <>
                  Adding...
                  <Spinner />
                </>
              ) : (
                "Add"
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
