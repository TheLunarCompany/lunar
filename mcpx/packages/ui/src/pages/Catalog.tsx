import { getMcpColorByName } from "@/components/dashboard/constants";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";
import { useAddMcpServer } from "@/data/mcp-server";
import { useGetMCPServers } from "@/data/catalog-servers";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useSocketStore } from "@/store";
import { useAuth } from "@/contexts/useAuth";
import { isAdmin } from "@/utils/auth";
import {
  handleMultipleServers,
  validateAndProcessServer,
  validateServerCommand,
  validateServerName,
  CatalogMCPServerConfigByNameItem,
} from "@mcpx/toolkit-ui/src/utils/server-helpers";
import {
  mcpJsonSchema,
  serverNameSchema,
} from "@mcpx/toolkit-ui/src/utils/mcpJson";
import { AxiosError } from "axios";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod/v4";
import { McpJsonForm } from "@/components/dashboard/McpJsonForm";
import {
  CustomTabs,
  CustomTabsContent,
  CustomTabsList,
  CustomTabsTrigger,
} from "@/components/ui/custom-tabs";
import { JsonUpload } from "@/components/ui/json-upload";
import { Separator } from "@/components/ui/separator";
import { editor } from "monaco-editor";
import { Input } from "@/components/ui/input";
import { ServerCard } from "@/components/dashboard/ServerCard";
import { getIconKey } from "@/hooks/useDomainIcon";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";

type ServerCatalogStatus =
  | "connected"
  | "inactive"
  | "pending-auth"
  | "pending-input"
  | "connection-failed";

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
 */
const extractServerConfig = (
  parsed: Record<string, unknown>,
): Record<string, unknown> => {
  if (typeof parsed !== "object" || parsed === null) {
    return parsed;
  }

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

  const keys = Object.keys(parsed);
  if (keys.length === 1) {
    const topLevelKey = keys[0];
    const topLevelValue = parsed[topLevelKey];

    if (typeof topLevelValue === "object" && topLevelValue !== null) {
      const nestedKeys = Object.keys(topLevelValue);
      const hasServerLikeKeys = nestedKeys.some((key) => {
        const result = serverNameSchema.safeParse(key);
        return result.success;
      });

      if (hasServerLikeKeys) {
        return topLevelValue as Record<string, unknown>;
      }
    }
  }

  return parsed;
};

type TabValue = "all" | "custom" | "migrate";

const TABS = {
  ALL: "all" as const,
  CUSTOM: "custom" as const,
  MIGRATE: "migrate" as const,
} as const;

export default function Catalog() {
  const navigate = useNavigate();
  const systemState = useSocketStore((s) => s.systemState);
  const { appConfig } = useSocketStore((s) => ({
    appConfig: s.appConfig,
  }));
  const { mutate: addServer, isPending, error } = useAddMcpServer();
  const { data: serversFromCatalogData } = useGetMCPServers();
  const serversFromCatalog = serversFromCatalogData ?? [];
  const { user } = useAuth();
  const userIsAdmin = isAdmin(user);
  const [name, setName] = useState(DEFAULT_SERVER_NAME);
  const [search, setSearch] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [customJsonContent, setCustomJsonContent] = useState(
    DEFAULT_SERVER_CONFIGURATION_JSON,
  );
  const [migrateJsonContent, setMigrateJsonContent] = useState("");
  // Initialize tab based on admin status to prevent flicker
  const [activeTab, setActiveTab] = useState<TabValue>(() => TABS.ALL);
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (!userIsAdmin && activeTab !== TABS.ALL) {
      setActiveTab(TABS.ALL);
    }
  }, [userIsAdmin, activeTab]);

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

  function getServerStatus(name: string): ServerCatalogStatus | undefined {
    const server = systemState?.targetServers.find(
      (s) => s.name.toLowerCase() === name.toLowerCase(),
    );

    if (!server) {
      return undefined;
    }

    const serverAttributes = (
      appConfig as {
        targetServerAttributes?: Record<string, { inactive: boolean }>;
      } | null
    )?.targetServerAttributes?.[server.name];
    if (serverAttributes?.inactive === true) {
      return "inactive";
    }

    return server.state.type;
  }

  const handleAddServer = (_name: string, jsonContent: string) => {
    let parsedJson;
    try {
      parsedJson = JSON.parse(jsonContent);
    } catch (_e) {
      showError("Invalid JSON format");
      return;
    }

    const serversObject = parsedJson.mcpServers || parsedJson;
    const serverNames = Object.keys(serversObject);

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
      icon: getIconKey(actualServerName)
        ? undefined
        : getMcpColorByName(actualServerName),
      existingServers: systemState?.targetServers || [],
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
            domain: server.name,
          });
          resetFormState();
          navigate("/dashboard");
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
      existingServers: systemState?.targetServers || [],
      getIcon: (serverName) =>
        getIconKey(serverName) ? undefined : getMcpColorByName(serverName),
      addServer,
    });

    const { successfulServers, failedServers } = result;

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
      navigate("/dashboard");
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
        const serverConfig = extractServerConfig(parsed);
        const keys = Object.keys(serverConfig);

        const validServerNames = keys.filter((key) => {
          const result = serverNameSchema.safeParse(key);
          return result.success;
        });

        if (validServerNames.length === 0) {
          setName("");
          return;
        }

        setName(validServerNames[0]);
      } catch (e) {
        console.warn("Invalid JSON format:", e);
        setName("");
      }
    },
    [errorMessage],
  );

  const handleMigrateFileUpload = useCallback(() => {
    // File upload handler - can be extended if needed
  }, []);

  const resetFormState = useCallback(() => {
    setName(DEFAULT_SERVER_NAME);
    setCustomJsonContent(DEFAULT_SERVER_CONFIGURATION_JSON);
    setMigrateJsonContent("");
    setErrorMessage("");
    setIsValid(true);
    setSearch("");
    setActiveTab(TABS.ALL);
  }, []);

  const handleUseExample = (
    config: Record<string, unknown>,
    serverName: string,
    needsEdit?: boolean,
  ) => {
    const newJsonContent = JSON.stringify(config, null, 2);
    setCustomJsonContent(newJsonContent);
    setName(serverName);

    if (!needsEdit) {
      handleAddServer(serverName, newJsonContent);
      return;
    }
    setActiveTab(TABS.CUSTOM);
  };

  const handleValidate = useCallback((markers: editor.IMarker[]) => {
    setIsValid(markers.length === 0);
  }, []);

  // Set overflow-y: hidden on html when component mounts, remove when unmounts
  useEffect(() => {
    const htmlElement = document.documentElement;
    const originalOverflow = htmlElement.style.overflowY;

    htmlElement.style.overflowY = "hidden";

    return () => {
      htmlElement.style.overflowY = originalOverflow;
    };
  }, []);

  return (
    <div className="w-full bg-gray-100 p-6 ">
      <div className="text-[20px] font-semibold mb-3 px-2">Catalog</div>

      <div className="flex flex-col px-2">
        <div>
          <CustomTabs
            value={activeTab}
            onValueChange={(value: string) => {
              const newTab = value as TabValue;
              if (!userIsAdmin && newTab !== TABS.ALL) {
                return;
              }
              setActiveTab(newTab);
            }}
          >
            <CustomTabsList>
              <CustomTabsTrigger value={TABS.ALL}>All</CustomTabsTrigger>
              {userIsAdmin && (
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
            {activeTab === TABS.ALL && (
              <div className="mt-4 w-[400px] relative">
                <Input
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="pr-10 rounded-lg"
                  style={{
                    borderRadius: "8px",
                    border: "1px solid #D8DCED",
                  }}
                />
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            )}

            {activeTab === TABS.CUSTOM && (
              <div className="my-4 text-sm">
                Add the server to your configuration by pasting your server's
                JSON configuration below.
              </div>
            )}
            {!userIsAdmin && activeTab !== TABS.ALL && (
              <div className="my-4 p-3 bg-[var(--color-bg-container-secondary)] border border-[var(--color-border-primary)] rounded-md">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Admin permissions required
                </p>
              </div>
            )}
            <CustomTabsContent value={TABS.ALL}>
              <div className="bg-white rounded-lg  shadow-sm border border-gray-200 h-[calc(100vh-180px)] flex flex-col overflow-hidden rounded-[8px]">
                <p className="text-[16px] font-semibold  flex-shrink-0 px-6 pt-6 pb-4">
                  Servers
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mx-2 p-6 pt-0 overflow-y-auto flex-1 min-h-0 pb-4 content-start">
                  {serversFromCatalog
                    .filter((catalogServer: CatalogMCPServerConfigByNameItem) =>
                      catalogServer.displayName
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                    )
                    .sort((a, b) => {
                      return a.name.localeCompare(b.name);
                    })
                    .map((example: CatalogMCPServerConfigByNameItem) => (
                      <ServerCard
                        key={example.name}
                        server={example}
                        status={getServerStatus(example.name)}
                        className="w-full"
                        onAddServer={handleUseExample}
                      />
                    ))}
                </div>
              </div>
            </CustomTabsContent>
            {userIsAdmin && (
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
            )}
            {userIsAdmin && (
              <CustomTabsContent value={TABS.MIGRATE}>
                <div className="mb-3">
                  <div className="mb-3 text-sm">
                    Add servers by uploading a JSON file or dragging and
                    dropping it here.
                  </div>
                  <JsonUpload
                    value={migrateJsonContent}
                    onChange={handleMigrateJsonChange}
                    onFileUpload={handleMigrateFileUpload}
                    onValidate={handleValidate}
                    height="500px"
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
            )}
          </CustomTabs>
        </div>
      </div>

      {isPending && (
        <div className="px-6 flex-shrink-0 mt-4">
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
          <Button
            onClick={() => navigate(-1)}
            className="text-component-primary"
            variant="ghost"
            type="button"
          >
            Cancel
          </Button>
          <Button
            disabled={!isValid || isPending}
            onClick={() => {
              if (activeTab === TABS.CUSTOM) {
                handleAddServer(name, customJsonContent);
              } else if (activeTab === TABS.MIGRATE) {
                handleAddServer(name, migrateJsonContent);
              }
            }}
            type="button"
          >
            {isPending ? (
              <div className="flex items-center gap-2">
                <Spinner className="w-4 h-4" />
                Adding...
              </div>
            ) : (
              "Add"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
