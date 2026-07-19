import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden as VisuallyHiddenPrimitive } from "radix-ui";
const VisuallyHidden = VisuallyHiddenPrimitive.Root;

import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";
import { useAddMcpServer } from "@/data/mcp-server";
import { useGetMCPServers } from "@/data/catalog-servers";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useSocketStore } from "@/store";
import { ErrorBanner } from "@/components/ErrorBanner";
import { usePermissions } from "@/data/permissions";
import {
  handleMultipleServers,
  validateAndProcessServer,
  validateServerCommand,
  validateServerName,
  getReservedServersNames,
} from "@mcpx/toolkit-ui/src/utils/server-helpers";
import {
  mcpJsonSchema,
  serverNameSchema,
} from "@mcpx/toolkit-ui/src/utils/mcpJson";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
import { McpRegistryCard } from "@/components/mcp-servers/McpRegistryCard";
import { SearchInput } from "@/components/ui/search-input";
import { Checkbox } from "@/components/ui/checkbox";
import { CustomAddCheckboxText } from "@/config/runtime-config";
import type { McpServerStatus } from "@/types";
import { getMcpServerStatusFromTargetServer } from "./helpers";
import { getAddServerErrorMessage } from "@/lib/api-errors";
import { Sort } from "@/components/Sort";
import {
  buildInstalledCatalogServerLookup,
  CATALOG_SERVER_SORT_OPTIONS,
  type CatalogSortOrder,
  filterAndSortCatalogServers,
} from "@/mapping/catalog-servers";

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
type ErrorBannerVariant = "destructive" | "warning";

const TABS = {
  ALL: "all" as const,
  CUSTOM: "custom" as const,
  MIGRATE: "migrate" as const,
} as const;

function getFailedServerDetails(
  failedServers: string[],
  failedServerErrors?: Array<{ serverName: string; error: string }>,
): Array<{ serverName: string; error: string }> {
  return failedServerErrors && failedServerErrors.length > 0
    ? failedServerErrors
    : failedServers.map((serverName) => ({
        serverName,
        error: "Unknown error",
      }));
}

function getFailedServerBannerDetails(
  failedServers: string[],
  failedServerErrors?: Array<{ serverName: string; error: string }>,
): Array<{ label: string; message: string }> {
  return getFailedServerDetails(failedServers, failedServerErrors).map(
    ({ serverName, error }) => ({ label: serverName, message: error }),
  );
}

function MultiServerAddWarningDescription({
  successfulCount,
  failedServers,
  failedServerErrors,
}: {
  successfulCount: number;
  failedServers: string[];
  failedServerErrors?: Array<{ serverName: string; error: string }>;
}): ReactNode {
  const [isExpanded, setIsExpanded] = useState(false);
  const failures = getFailedServerDetails(failedServers, failedServerErrors);

  return (
    <div>
      <div>
        Added <strong>{successfulCount}</strong> server
        {successfulCount > 1 ? "s" : ""}. Failed to add{" "}
        <strong>{failedServers.length}</strong>.
      </div>
      <button
        type="button"
        className="mt-1 text-sm font-semibold text-current underline underline-offset-2"
        onClick={() => setIsExpanded((expanded) => !expanded)}
      >
        {isExpanded ? "Hide details" : "Show details"}
      </button>
      {isExpanded && (
        <ul className="mt-2 max-h-36 list-disc space-y-1 overflow-y-auto pl-5 pr-1 text-sm font-medium leading-5">
          {failures.map(({ serverName, error }) => (
            <li key={serverName}>
              <span className="font-semibold">{serverName}</span>: {error}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const AddServerModal = ({ onClose }: { onClose: () => void }) => {
  const systemState = useSocketStore((s) => s.systemState);
  const { appConfig } = useSocketStore((s) => ({
    appConfig: s.appConfig,
  }));
  const {
    mutate: addServer,
    mutateAsync: addServerAsync,
    isPending,
    error,
  } = useAddMcpServer();
  const { data: serversFromCatalogData } = useGetMCPServers();
  const serversFromCatalog = useMemo(
    () => serversFromCatalogData ?? [],
    [serversFromCatalogData],
  );
  const { canAddCustomServerAndEdit: canAddCustom } = usePermissions();
  const installedLookup = useMemo(
    () => buildInstalledCatalogServerLookup(systemState?.targetServers ?? []),
    [systemState?.targetServers],
  );

  const [name, setName] = useState(DEFAULT_SERVER_NAME);
  const checkboxText = CustomAddCheckboxText();
  const [isCheckboxChecked, setIsCheckboxChecked] = useState(false);

  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<CatalogSortOrder>("asc");
  const filteredCatalogServers = useMemo(
    () =>
      filterAndSortCatalogServers({
        servers: serversFromCatalog,
        searchQuery: search,
        sortOrder,
        installedLookup,
      }),
    [installedLookup, search, serversFromCatalog, sortOrder],
  );

  const [errorMessage, setErrorMessage] = useState("");
  const [errorVariant, setErrorVariant] =
    useState<ErrorBannerVariant>("destructive");
  const [errorDetails, setErrorDetails] = useState<
    Array<{ label: string; message: string }>
  >([]);
  const [customJsonContent, setCustomJsonContent] = useState(
    DEFAULT_SERVER_CONFIGURATION_JSON,
  );
  const [migrateJsonContent, setMigrateJsonContent] = useState("");
  const [hasUploadedFile, setHasUploadedFile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Initialize tab based on admin status to prevent flicker
  const [activeTab, setActiveTab] = useState<TabValue>(() => TABS.ALL);
  const colorScheme = useColorScheme();
  const isSaving = isPending || isSubmitting;

  useEffect(() => {
    if (!canAddCustom && activeTab !== TABS.ALL) {
      setActiveTab(TABS.ALL);
    }
  }, [canAddCustom, activeTab]);

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

  const showError = useCallback(
    (
      message: string,
      details: Array<{ label: string; message: string }> = [],
      variant: ErrorBannerVariant = "destructive",
    ) => {
      setErrorMessage(message);
      setErrorDetails(details);
      setErrorVariant(variant);
    },
    [],
  );

  useEffect(() => {
    if (!error) return;

    showError(getAddServerErrorMessage(error));
  }, [error, showError]);

  function getServerStatus(name: string): McpServerStatus | undefined {
    const server = systemState?.targetServers.find(
      (s) => s.name.toLowerCase() === name.toLowerCase(),
    );

    if (!server) {
      return undefined;
    }

    // Check if server is inactive from appConfig
    const serverAttributes = (
      appConfig as {
        targetServerAttributes?: Record<string, { inactive: boolean }>;
      } | null
    )?.targetServerAttributes?.[server.name];
    return getMcpServerStatusFromTargetServer(server, {
      inactive: serverAttributes?.inactive === true,
    });
  }

  const handleAddServer = (
    _name: string,
    jsonContent: string,
    catalogItemId?: string,
  ) => {
    showError("");
    let parsedJson;
    try {
      parsedJson = JSON.parse(jsonContent);
    } catch (_e) {
      showError("Invalid JSON format");
      return;
    }

    const serversObject = parsedJson.mcpServers || parsedJson;
    const serverNames = Object.keys(serversObject);

    // if a server is not added directly from the catalog, make sure it doesn't have a name that is in the catalog
    const reservedNames = getReservedServersNames(
      activeTab,
      serversFromCatalog,
    );

    if (serverNames.length > 1) {
      handleMultipleServersUpload(serversObject, serverNames);
      return;
    }

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
      existingServers: systemState?.targetServers || [],
      reservedNames: reservedNames,
      isEdit: false,
    });

    if (result.success === false || !result.payload) {
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

    const payload = catalogItemId
      ? { ...result.payload, catalogItemId }
      : result.payload;

    setIsSubmitting(true);
    addServer(
      {
        payload,
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
          setIsSubmitting(false);
          console.warn("Error adding server:", error);
          showError(getAddServerErrorMessage(error));
        },
      },
    );
  };

  const handleMultipleServersUpload = async (
    serversObject: Record<string, unknown>,
    serverNames: string[],
  ) => {
    showError("");
    setIsSubmitting(true);
    try {
      const reservedNames = getReservedServersNames(
        activeTab,
        serversFromCatalog,
      );
      const result = await handleMultipleServers({
        serversObject,
        serverNames,
        existingServers: systemState?.targetServers || [],
        reservedNames: reservedNames,
        addServer: (payload, callbacks) => {
          addServerAsync(payload)
            .then(() => callbacks.onSuccess())
            .catch((error) => callbacks.onError(error));
        },
      });

      const { successfulServers, failedServers, failedServerErrors } = result;
      const failedServerDetails = getFailedServerBannerDetails(
        failedServers,
        failedServerErrors,
      );

      if (successfulServers.length > 0 && failedServers.length === 0) {
        toast({
          description: (
            <>
              Successfully added <strong>{successfulServers.length}</strong>{" "}
              server{successfulServers.length > 1 ? "s" : ""}.
            </>
          ),
          title: "Servers Added",
          duration: 5000,
          isClosable: true,
          variant: "server-info",
          position: "bottom-left",
        });
        resetFormState();
        onClose();
      } else if (successfulServers.length > 0) {
        toast({
          description: (
            <MultiServerAddWarningDescription
              successfulCount={successfulServers.length}
              failedServers={failedServers}
              failedServerErrors={failedServerErrors}
            />
          ),
          descriptionClassName: "line-clamp-none text-current font-medium",
          title: "Some Servers Added",
          duration: 20000,
          isClosable: true,
          variant: "warning",
          position: "bottom-left",
        });
        showError(
          `Added ${successfulServers.length} server${
            successfulServers.length > 1 ? "s" : ""
          }. Failed to add ${failedServers.length}.`,
          failedServerDetails,
          "warning",
        );
      } else {
        showError("No servers were added.", failedServerDetails);
      }
    } finally {
      setIsSubmitting(false);
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
    [errorMessage, showError],
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
    [errorMessage, showError],
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
    setIsSubmitting(false);
    setErrorMessage("");
    setErrorDetails([]);
    setErrorVariant("destructive");
    setIsValid(true);
    setSearch("");
    setSortOrder("asc");
    setActiveTab(TABS.ALL);
    setIsCheckboxChecked(false);
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
            variant="destructive"
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
                variant="destructive"
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
    needsEdit?: boolean,
    catalogItemId?: string,
  ) => {
    const newJsonContent = JSON.stringify(config, null, 2);
    setCustomJsonContent(newJsonContent);
    setName(serverName);

    if (!needsEdit) {
      handleAddServer(serverName, newJsonContent, catalogItemId);
      return;
    }
    setActiveTab(TABS.CUSTOM);
  };

  const handleValidate = useCallback((markers: editor.IMarker[]) => {
    setIsValid(markers.length === 0);
  }, []);

  return (
    <Dialog open onOpenChange={handleDialogOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="top-[20px] bottom-[20px] left-1/2 -translate-x-1/2 translate-y-0 w-full sm:max-w-[1560px] max-h-none h-[calc(100vh-40px)] flex flex-col min-h-0 overflow-hidden bg-white border border-border rounded-lg px-6 py-5"
      >
        {errorMessage && (
          <ErrorBanner
            details={errorDetails}
            message={errorMessage}
            variant={errorVariant}
            onClose={() => {
              setErrorMessage("");
              setErrorDetails([]);
              setErrorVariant("destructive");
            }}
          />
        )}
        <VisuallyHidden>
          <DialogTitle>Add Server</DialogTitle>
        </VisuallyHidden>
        <div className="text-2xl font-semibold shrink-0">Add Server</div>
        <hr className="shrink-0" />
        <div className="flex flex-col min-h-0 flex-1 overflow-y-auto">
          <div className="min-h-0 flex flex-col flex-1">
            <CustomTabs
              className="flex flex-col min-h-0 flex-1"
              value={activeTab}
              onValueChange={(value: string) => {
                const newTab = value as TabValue;
                if (!canAddCustom && newTab !== TABS.ALL) {
                  return;
                }
                if (activeTab === TABS.MIGRATE && newTab !== TABS.MIGRATE) {
                  setHasUploadedFile(false);
                }
                showError("");
                setActiveTab(newTab);
              }}
            >
              <CustomTabsList>
                <CustomTabsTrigger value={TABS.ALL}>All</CustomTabsTrigger>
                {canAddCustom && (
                  <>
                    <CustomTabsTrigger value={TABS.CUSTOM}>
                      Custom
                    </CustomTabsTrigger>
                    <CustomTabsTrigger value={TABS.MIGRATE}>
                      Migrate
                    </CustomTabsTrigger>
                  </>
                )}
              </CustomTabsList>
              <div>
                {activeTab === TABS.ALL && (
                  <div className="my-4">
                    <div className="my-4 text-sm">
                      Select a server to add to your configuration"
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <SearchInput
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search..."
                        wrapperClassName="w-[320px] max-w-full ml-[3px]"
                        className="h-9 rounded-lg border-[#D8DCED] bg-white"
                      />
                      <Sort
                        title="Sort"
                        options={CATALOG_SERVER_SORT_OPTIONS}
                        selected={sortOrder}
                        onChange={setSortOrder}
                      />
                    </div>
                  </div>
                )}
                {!canAddCustom && activeTab !== TABS.ALL && (
                  <div className="my-4 p-3 bg-muted border border-border rounded-md">
                    <p className="text-sm text-muted-foreground">
                      Admin permissions required
                    </p>
                  </div>
                )}
              </div>
              <CustomTabsContent
                value={TABS.ALL}
                className="min-h-0 flex-1 flex flex-col overflow-hidden"
              >
                <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable]">
                  <div className="grid grid-cols-1 content-start gap-4 pb-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredCatalogServers.map((server) => (
                      <McpRegistryCard
                        key={server.name}
                        server={server}
                        status={getServerStatus(server.name)}
                        className="w-full border-[#E3E6EF] shadow-[0_1px_3px_rgba(16,24,40,0.10)]"
                        onAddServer={handleUseExample}
                      />
                    ))}
                  </div>
                </div>
              </CustomTabsContent>
              {canAddCustom && (
                <CustomTabsContent
                  value={TABS.CUSTOM}
                  className="flex-1 min-h-0 flex flex-col"
                >
                  <div className="mb-2 mt-4 text-sm shrink-0">
                    Add the server to your configuration by pasting your
                    server's JSON configuration below.
                  </div>
                  <div className="flex-1 min-h-0 max-h-[600px] flex flex-col">
                    <McpJsonForm
                      colorScheme={colorScheme}
                      fillHeight
                      onValidate={handleValidate}
                      onChange={handleJsonChange}
                      placeholder={DEFAULT_SERVER_CONFIGURATION_JSON}
                      schema={z.toJSONSchema(mcpJsonSchema)}
                      value={customJsonContent}
                    />
                  </div>
                  {checkboxText && (
                    <div className="flex items-center space-x-2 mt-2 shrink-0">
                      <Checkbox
                        id="custom-add-checkbox"
                        checked={isCheckboxChecked}
                        onCheckedChange={(checked) =>
                          setIsCheckboxChecked(checked === true)
                        }
                      />
                      <label
                        htmlFor="custom-add-checkbox"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {checkboxText}
                      </label>
                    </div>
                  )}

                  <Separator className="my-4 shrink-0" />
                  <div className="w-full flex justify-between shrink-0">
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
                        isSaving ||
                        !isDirty ||
                        !isValid ||
                        (checkboxText ? !isCheckboxChecked : false)
                      }
                      className="px-5"
                      onClick={() => handleAddServer(name, customJsonContent)}
                    >
                      {isSaving ? (
                        <>
                          Adding...
                          <Spinner />
                        </>
                      ) : (
                        "Add"
                      )}
                    </Button>
                  </div>
                </CustomTabsContent>
              )}
              {canAddCustom && (
                <CustomTabsContent
                  value={TABS.MIGRATE}
                  className="flex-1 min-h-0 flex flex-col"
                >
                  <div className="mb-2 mt-4 text-sm shrink-0">
                    Add servers to your configuration by pasting your JSON
                    configuration below or upload file.
                  </div>
                  <div className="flex-1 min-h-0 max-h-[600px] flex flex-col">
                    <JsonUpload
                      value={migrateJsonContent}
                      onChange={handleMigrateJsonChange}
                      onFileUpload={handleMigrateFileUpload}
                      onValidate={handleValidate}
                      fillHeight
                    />
                  </div>
                  {checkboxText && (
                    <div className="flex items-center space-x-2 mt-2 shrink-0">
                      <Checkbox
                        id="custom-add-checkbox"
                        checked={isCheckboxChecked}
                        onCheckedChange={(checked) =>
                          setIsCheckboxChecked(checked === true)
                        }
                      />
                      <label
                        htmlFor="custom-add-checkbox"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {checkboxText}
                      </label>
                    </div>
                  )}
                  <Separator className="my-4 shrink-0" />
                  <div className="w-full flex justify-between shrink-0">
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
                        isSaving ||
                        !isDirty ||
                        !isValid ||
                        (checkboxText ? !isCheckboxChecked : false)
                      }
                      className="px-5"
                      onClick={() => handleAddServer(name, migrateJsonContent)}
                    >
                      {isSaving ? (
                        <>
                          Adding...
                          <Spinner />
                        </>
                      ) : (
                        "Add"
                      )}
                    </Button>
                  </div>
                </CustomTabsContent>
              )}
            </CustomTabs>
          </div>
        </div>

        {isSaving && (
          <div className="px-6 shrink-0">
            <div className="space-y-2">
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted animate-pulse">
                <div className="absolute inset-0 bg-linear-to-r from-transparent via-primary to-transparent animate-[shimmer_2s_ease-in-out_infinite]" />
                <div className="absolute inset-0 bg-linear-to-r from-primary via-transparent to-primary animate-[shimmer_1.5s_ease-in-out_infinite_reverse]" />
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
