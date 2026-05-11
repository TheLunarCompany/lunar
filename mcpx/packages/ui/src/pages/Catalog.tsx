import { getMcpColorByName } from "@/components/dashboard/constants";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";
import { useAddMcpServer } from "@/data/mcp-server";
import { useGetMCPServers } from "@/data/catalog-servers";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useSocketStore } from "@/store";
import { usePermissions } from "@/data/permissions";
import {
  handleMultipleServers,
  validateAndProcessServer,
  validateServerCommand,
  validateServerName,
  CatalogMCPServerConfigByNameItem,
  getReservedServersNames,
} from "@mcpx/toolkit-ui/src/utils/server-helpers";
import {
  mcpJsonSchema,
  serverNameSchema,
} from "@mcpx/toolkit-ui/src/utils/mcpJson";
import { AxiosError } from "axios";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
import { ServerCard } from "@/components/dashboard/ServerCard";
import { ErrorBanner } from "@/components/ErrorBanner";
import { getIconKey } from "@/hooks/useDomainIcon";
import { routes } from "@/routes";
import { useNavigate } from "react-router-dom";
import { SearchInput } from "@/components/ui/search-input";
import { Checkbox } from "@/components/ui/checkbox";
import { CustomAddCheckboxText } from "@/config/runtime-config";
import type { McpServerStatus } from "@/types";
import { getMcpServerStatusFromTargetServer } from "@/components/dashboard/helpers";

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

export default function Catalog() {
  const navigate = useNavigate();
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
  const serversFromCatalog = serversFromCatalogData ?? [];
  const { canAddCustomServerAndEdit: canAddCustom } = usePermissions();
  const [name, setName] = useState(DEFAULT_SERVER_NAME);
  const [search, setSearch] = useState("");
  const [customTabError, setCustomTabError] = useState("");
  const [migrateTabError, setMigrateTabError] = useState("");
  const [customTabErrorVariant, setCustomTabErrorVariant] =
    useState<ErrorBannerVariant>("destructive");
  const [migrateTabErrorVariant, setMigrateTabErrorVariant] =
    useState<ErrorBannerVariant>("destructive");
  const [customTabErrorDetails, setCustomTabErrorDetails] = useState<
    Array<{ label: string; message: string }>
  >([]);
  const [migrateTabErrorDetails, setMigrateTabErrorDetails] = useState<
    Array<{ label: string; message: string }>
  >([]);
  const lastAddTabRef = useRef<TabValue>(TABS.CUSTOM);
  const [customJsonContent, setCustomJsonContent] = useState(
    DEFAULT_SERVER_CONFIGURATION_JSON,
  );
  const [migrateJsonContent, setMigrateJsonContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Initialize tab based on admin status to prevent flicker
  const [activeTab, setActiveTab] = useState<TabValue>(() => TABS.ALL);
  const colorScheme = useColorScheme();
  const isSaving = isPending || isSubmitting;
  const checkboxText = CustomAddCheckboxText();
  const [isCheckboxChecked, setIsCheckboxChecked] = useState(false);

  useEffect(() => {
    if (!canAddCustom && activeTab !== TABS.ALL) {
      setActiveTab(TABS.ALL);
    }
  }, [canAddCustom, activeTab]);

  const [isValid, setIsValid] = useState(true);
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const showErrorForTab = useCallback(
    (
      message: string,
      tab: TabValue,
      details: Array<{ label: string; message: string }> = [],
      variant: ErrorBannerVariant = "destructive",
    ) => {
      if (tab === TABS.CUSTOM) {
        setCustomTabError(message);
        setCustomTabErrorDetails(details);
        setCustomTabErrorVariant(variant);
      } else if (tab === TABS.MIGRATE) {
        setMigrateTabError(message);
        setMigrateTabErrorDetails(details);
        setMigrateTabErrorVariant(variant);
      }
    },
    [],
  );

  useEffect(() => {
    if (!error) return;

    const message =
      error instanceof AxiosError && error.response?.data?.msg
        ? error.response.data.msg
        : "Failed to add server. Please try again.";

    showErrorForTab(message, lastAddTabRef.current);
  }, [error, showErrorForTab]);

  function getServerStatus(name: string): McpServerStatus | undefined {
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
    return getMcpServerStatusFromTargetServer(server, {
      inactive: serverAttributes?.inactive === true,
    });
  }

  const handleAddServer = (
    _name: string,
    jsonContent: string,
    tab: TabValue,
    catalogItemId?: string,
  ) => {
    lastAddTabRef.current = tab;
    let parsedJson;
    try {
      parsedJson = JSON.parse(jsonContent);
    } catch (_e) {
      showErrorForTab("Invalid JSON format", tab);
      return;
    }

    // if a server is not added directly from the catalog, make sure it doesn't have a name that is in the catalog
    const reservedNames = getReservedServersNames(
      activeTab,
      serversFromCatalog,
    );

    const serversObject = parsedJson.mcpServers || parsedJson;
    const serverNames = Object.keys(serversObject);

    if (serverNames.length > 1) {
      handleMultipleServersUpload(serversObject, serverNames, tab);
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
      reservedNames: reservedNames,
      isEdit: false,
    });

    if (result.success === false || !result.payload) {
      showErrorForTab(
        result.error || "Failed to add server. Please try again.",
        tab,
      );
      return;
    }

    const nameError = validateServerName(actualServerName);

    if (nameError) {
      showErrorForTab(nameError, tab);
      return;
    }

    const commandError = validateServerCommand(result.payload);
    if (commandError) {
      showErrorForTab(commandError, tab);
      return;
    }

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
            domain: server.name,
          });
          resetFormState();
          navigate(routes.dashboard);
        },
        onError: (error) => {
          setIsSubmitting(false);
          console.warn("Error adding server:", error);
        },
      },
    );
  };

  const handleMultipleServersUpload = async (
    serversObject: Record<string, unknown>,
    serverNames: string[],
    tab: TabValue,
  ) => {
    lastAddTabRef.current = tab;
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
        getIcon: (serverName) =>
          getIconKey(serverName) ? undefined : getMcpColorByName(serverName),
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
        navigate(routes.dashboard);
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
        showErrorForTab(
          `Added ${successfulServers.length} server${
            successfulServers.length > 1 ? "s" : ""
          }. Failed to add ${failedServers.length}.`,
          tab,
          failedServerDetails,
          "warning",
        );
      } else {
        showErrorForTab("No servers were added.", tab, failedServerDetails);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJsonChange = useCallback(
    (value: string) => {
      setCustomJsonContent(() => value);
      if (customTabError.length > 0) {
        setCustomTabError("");
        setCustomTabErrorDetails([]);
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
    [customTabError],
  );

  const handleMigrateJsonChange = useCallback(
    (value: string) => {
      setMigrateJsonContent(value);
      if (migrateTabError.length > 0) {
        setMigrateTabError("");
        setMigrateTabErrorDetails([]);
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
    [migrateTabError],
  );

  const handleMigrateFileUpload = useCallback(() => {
    // File upload handler - can be extended if needed
  }, []);

  const resetFormState = useCallback(() => {
    setName(DEFAULT_SERVER_NAME);
    setCustomJsonContent(DEFAULT_SERVER_CONFIGURATION_JSON);
    setMigrateJsonContent("");
    setIsSubmitting(false);
    setCustomTabError("");
    setMigrateTabError("");
    setCustomTabErrorDetails([]);
    setMigrateTabErrorDetails([]);
    setCustomTabErrorVariant("destructive");
    setMigrateTabErrorVariant("destructive");
    setIsValid(true);
    setSearch("");
    setActiveTab(TABS.ALL);
    setIsCheckboxChecked(false);
  }, []);

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
      handleAddServer(serverName, newJsonContent, TABS.CUSTOM, catalogItemId);
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
    <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto bg-white p-6">
      {activeTab === TABS.CUSTOM && customTabError && (
        <ErrorBanner
          details={customTabErrorDetails}
          message={customTabError}
          variant={customTabErrorVariant}
          onClose={() => {
            setCustomTabError("");
            setCustomTabErrorDetails([]);
            setCustomTabErrorVariant("destructive");
          }}
        />
      )}
      {activeTab === TABS.MIGRATE && migrateTabError && (
        <ErrorBanner
          details={migrateTabErrorDetails}
          message={migrateTabError}
          variant={migrateTabErrorVariant}
          onClose={() => {
            setMigrateTabError("");
            setMigrateTabErrorDetails([]);
            setMigrateTabErrorVariant("destructive");
          }}
        />
      )}
      <h1 className="mb-5 text-[20px] font-semibold text-[#20222A]">Catalog</h1>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          <CustomTabs
            className="flex min-h-0 flex-1 flex-col"
            value={activeTab}
            onValueChange={(value: string) => {
              const newTab = value as TabValue;
              if (!canAddCustom && newTab !== TABS.ALL) {
                return;
              }
              setActiveTab(newTab);
            }}
          >
            <CustomTabsList className="mb-4">
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
            {activeTab === TABS.ALL && (
              <SearchInput
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                wrapperClassName="mb-4 w-[320px]"
                className="h-9 rounded-lg border-[#D8DCED] bg-white"
              />
            )}

            {!canAddCustom && activeTab !== TABS.ALL && (
              <div className="my-4 p-3 bg-muted border border-border rounded-md">
                <p className="text-sm text-muted-foreground">
                  Admin permissions required
                </p>
              </div>
            )}
            <CustomTabsContent
              value={TABS.ALL}
              className="min-h-0 flex-1 overflow-hidden"
            >
              <div className="grid h-full grid-cols-1 content-start gap-4 overflow-y-auto pb-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                      className="w-full border-[#E3E6EF] shadow-[0_1px_3px_rgba(16,24,40,0.10)]"
                      onAddServer={handleUseExample}
                    />
                  ))}
              </div>
            </CustomTabsContent>
            {canAddCustom && (
              <CustomTabsContent
                value={TABS.CUSTOM}
                className="min-h-[560px] flex flex-col"
              >
                <div className="mb-3 text-sm">
                  Add the server to your configuration by pasting your server's
                  JSON configuration below.
                </div>
                <McpJsonForm
                  colorScheme={colorScheme}
                  onValidate={handleValidate}
                  onChange={handleJsonChange}
                  placeholder={DEFAULT_SERVER_CONFIGURATION_JSON}
                  schema={z.toJSONSchema(mcpJsonSchema)}
                  value={customJsonContent}
                />

                {checkboxText && (
                  <div className="flex items-center space-x-2 mt-2">
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

                <Separator className="my-4" />
              </CustomTabsContent>
            )}
            {canAddCustom && (
              <CustomTabsContent
                value={TABS.MIGRATE}
                className="min-h-[560px] flex flex-col"
              >
                <div className="mb-[2px]">
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
                </div>
                {checkboxText && (
                  <div className="flex items-center space-x-2 mt-2">
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
                <Separator className="my-4" />
              </CustomTabsContent>
            )}
          </CustomTabs>
        </div>
      </div>

      {isSaving && (
        <div className="px-6 shrink-0 mt-4">
          <div className="space-y-2">
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted animate-pulse">
              <div className="absolute inset-0 bg-linear-to-r from-transparent via-primary to-transparent animate-[shimmer_2s_ease-in-out_infinite]" />
              <div className="absolute inset-0 bg-linear-to-r from-primary via-transparent to-primary animate-[shimmer_1.5s_ease-in-out_infinite_reverse]" />
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
            disabled={
              !isValid ||
              isSaving ||
              (checkboxText ? !isCheckboxChecked : false)
            }
            className="px-5"
            onClick={() => {
              if (activeTab === TABS.CUSTOM) {
                handleAddServer(name, customJsonContent, TABS.CUSTOM);
              } else if (activeTab === TABS.MIGRATE) {
                handleAddServer(name, migrateJsonContent, TABS.MIGRATE);
              }
            }}
            type="button"
          >
            {isSaving ? (
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
