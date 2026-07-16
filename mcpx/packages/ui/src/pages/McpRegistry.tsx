import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  getReservedServersNames,
  handleMultipleServers,
  validateAndProcessServer,
  validateServerCommand,
  validateServerName,
} from "@mcpx/toolkit-ui/src/utils/server-helpers";
import {
  mcpJsonSchema,
  serverNameSchema,
} from "@mcpx/toolkit-ui/src/utils/mcpJson";
import type { editor } from "monaco-editor";
import { z } from "zod/v4";
import { McpRegistryCard } from "@/components/mcp-servers/McpRegistryCard";
import { McpJsonForm } from "@/components/dashboard/McpJsonForm";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Sort } from "@/components/Sort";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CustomTabs,
  CustomTabsContent,
  CustomTabsList,
  CustomTabsTrigger,
} from "@/components/ui/custom-tabs";
import { JsonUpload } from "@/components/ui/json-upload";
import { SearchInput } from "@/components/ui/search-input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";
import { CustomAddCheckboxText } from "@/config/runtime-config";
import { useGetMCPServers } from "@/data/catalog-servers";
import { useAddMcpServer } from "@/data/mcp-server";
import { usePermissions } from "@/data/permissions";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getAddServerErrorMessage } from "@/lib/api-errors";
import {
  buildInstalledCatalogServerLookup,
  CATALOG_SERVER_SORT_OPTIONS,
  type CatalogSortOrder,
  filterAndSortCatalogServers,
} from "@/mapping/catalog-servers";
import { routes } from "@/routes";
import { useSocketStore } from "@/store";
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

const TABS = {
  ALL: "all",
  CUSTOM: "custom",
  MIGRATE: "migrate",
} as const;

type TabValue = "all" | "custom" | "migrate";
type ErrorBannerVariant = "destructive" | "warning";

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
  const failures =
    failedServerErrors && failedServerErrors.length > 0
      ? failedServerErrors
      : failedServers.map((serverName) => ({
          serverName,
          error: "Unknown error",
        }));

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

export default function McpRegistry() {
  const navigate = useNavigate();
  const systemState = useSocketStore((s) => s.systemState);
  const targetServers = useSocketStore(
    (state) => state.systemState?.targetServers ?? [],
  );
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
    () => buildInstalledCatalogServerLookup(targetServers),
    [targetServers],
  );
  const [name, setName] = useState(DEFAULT_SERVER_NAME);
  const [activeTab, setActiveTab] = useState<TabValue>(TABS.ALL);
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customJsonContent, setCustomJsonContent] = useState(
    DEFAULT_SERVER_CONFIGURATION_JSON,
  );
  const [migrateJsonContent, setMigrateJsonContent] = useState("");
  const [isValid, setIsValid] = useState(true);
  const [isCheckboxChecked, setIsCheckboxChecked] = useState(false);
  const [allTabError, setAllTabError] = useState("");
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
  const colorScheme = useColorScheme();
  const checkboxText = CustomAddCheckboxText();
  const isSaving = isPending || isSubmitting;
  const { toast } = useToast();

  useEffect(() => {
    if (!canAddCustom && activeTab !== TABS.ALL) {
      setActiveTab(TABS.ALL);
    }
  }, [canAddCustom, activeTab]);

  const showErrorForTab = useCallback(
    (
      message: string,
      tab: TabValue,
      details: Array<{ label: string; message: string }> = [],
      variant: ErrorBannerVariant = "destructive",
    ) => {
      if (tab === TABS.ALL) {
        setAllTabError(message);
      } else if (tab === TABS.CUSTOM) {
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
    showErrorForTab(getAddServerErrorMessage(error), lastAddTabRef.current);
  }, [error, showErrorForTab]);

  function getServerStatus(name: string): McpServerStatus | undefined {
    const server = systemState?.targetServers.find(
      (targetServer) => targetServer.name.toLowerCase() === name.toLowerCase(),
    );
    if (!server) return undefined;

    const serverAttributes = (
      appConfig as {
        targetServerAttributes?: Record<string, { inactive: boolean }>;
      } | null
    )?.targetServerAttributes?.[server.name];
    return getMcpServerStatusFromTargetServer(server, {
      inactive: serverAttributes?.inactive === true,
    });
  }

  const resetFormState = useCallback(() => {
    setName(DEFAULT_SERVER_NAME);
    setCustomJsonContent(DEFAULT_SERVER_CONFIGURATION_JSON);
    setMigrateJsonContent("");
    setIsSubmitting(false);
    setAllTabError("");
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

  const handleMultipleServersUpload = async (
    serversObject: Record<string, unknown>,
    serverNames: string[],
    tab: TabValue,
  ) => {
    lastAddTabRef.current = tab;
    setIsSubmitting(true);
    try {
      const result = await handleMultipleServers({
        serversObject,
        serverNames,
        existingServers: systemState?.targetServers || [],
        reservedNames: getReservedServersNames(activeTab, serversFromCatalog),
        addServer: (payload, callbacks) => {
          addServerAsync(payload)
            .then(() => callbacks.onSuccess())
            .catch((serverError) => callbacks.onError(serverError));
        },
      });

      const { successfulServers, failedServers, failedServerErrors } = result;
      const failedDetails = (
        failedServerErrors && failedServerErrors.length > 0
          ? failedServerErrors
          : failedServers.map((serverName) => ({
              serverName,
              error: "Unknown error",
            }))
      ).map(({ serverName, error }) => ({
        label: serverName,
        message: error,
      }));

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
          failedDetails,
          "warning",
        );
      } else {
        showErrorForTab("No servers were added.", tab, failedDetails);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddServer = (
    _name: string,
    jsonContent: string,
    tab: TabValue,
    catalogItemId?: string,
  ): void => {
    lastAddTabRef.current = tab;
    let parsedJson;
    try {
      parsedJson = JSON.parse(jsonContent);
    } catch (_error) {
      showErrorForTab("Invalid JSON format", tab);
      return;
    }

    const reservedNames = getReservedServersNames(
      activeTab,
      serversFromCatalog,
    );
    const serversObject = parsedJson.mcpServers || parsedJson;
    const serverNames = Object.keys(serversObject);
    if (serverNames.length > 1) {
      void handleMultipleServersUpload(serversObject, serverNames, tab);
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
      reservedNames,
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
      { payload },
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
        onError: (serverError) => {
          setIsSubmitting(false);
          console.warn("Error adding server:", serverError);
        },
      },
    );
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
        setName(result.success ? result.data : "");
      } catch (parseError) {
        console.warn("Invalid JSON format:", parseError);
        setName("");
      }
    },
    [customTabError],
  );

  const handleMigrateJsonChange = useCallback(
    (value: string) => {
      setMigrateJsonContent(value);
      if (migrateTabError) {
        setMigrateTabError("");
        setMigrateTabErrorDetails([]);
      }
      try {
        const parsed = JSON.parse(value);
        const serverConfig = extractServerConfig(parsed);
        const validServerNames = Object.keys(serverConfig).filter(
          (serverName) => serverNameSchema.safeParse(serverName).success,
        );
        setName(validServerNames[0] ?? "");
      } catch (parseError) {
        console.warn("Invalid JSON format:", parseError);
        setName("");
      }
    },
    [migrateTabError],
  );

  const handleValidate = useCallback((markers: editor.IMarker[]) => {
    setIsValid(markers.length === 0);
  }, []);

  const handleUseExample = (
    config: Record<string, unknown>,
    serverName: string,
    needsEdit?: boolean,
    catalogItemId?: string,
  ): void => {
    const newJsonContent = JSON.stringify(config, null, 2);
    setCustomJsonContent(newJsonContent);
    setName(serverName);
    if (!needsEdit) {
      handleAddServer(serverName, newJsonContent, TABS.ALL, catalogItemId);
      return;
    }
    setActiveTab(TABS.CUSTOM);
  };

  useEffect(() => {
    const htmlElement = document.documentElement;
    const originalOverflow = htmlElement.style.overflowY;
    htmlElement.style.overflowY = "hidden";
    return () => {
      htmlElement.style.overflowY = originalOverflow;
    };
  }, []);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-white p-6">
      {activeTab === TABS.ALL && allTabError && (
        <ErrorBanner message={allTabError} onClose={() => setAllTabError("")} />
      )}
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
      <h1 className="mb-5 shrink-0 text-[20px] font-semibold text-[#20222A]">
        MCP Registry
      </h1>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <CustomTabs
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            value={activeTab}
            onValueChange={(value: string) => {
              const newTab = value as TabValue;
              if (!canAddCustom && newTab !== TABS.ALL) return;
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
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <SearchInput
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search..."
                  wrapperClassName="w-[320px] max-w-full"
                  className="h-9 rounded-lg border-[#D8DCED] bg-white"
                />
                <Sort
                  title="Sort"
                  options={CATALOG_SERVER_SORT_OPTIONS}
                  selected={sortOrder}
                  onChange={setSortOrder}
                />
              </div>
            )}
            {!canAddCustom && activeTab !== TABS.ALL && (
              <div className="my-4 rounded-md border border-border bg-muted p-3">
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
            </CustomTabsContent>

            {canAddCustom && (
              <CustomTabsContent
                value={TABS.CUSTOM}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="mb-3 shrink-0 text-sm">
                  Add the server to your configuration by pasting your
                  server&apos;s JSON configuration below.
                </div>
                <div className="flex min-h-0 max-h-[600px] flex-1 flex-col">
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
                  <div className="mt-2 flex shrink-0 items-center space-x-2">
                    <Checkbox
                      id="custom-add-checkbox"
                      checked={isCheckboxChecked}
                      onCheckedChange={(checked) =>
                        setIsCheckboxChecked(checked === true)
                      }
                    />
                    <label
                      htmlFor="custom-add-checkbox"
                      className="text-sm font-medium leading-none"
                    >
                      {checkboxText}
                    </label>
                  </div>
                )}
                <Separator className="my-4 shrink-0" />
              </CustomTabsContent>
            )}

            {canAddCustom && (
              <CustomTabsContent
                value={TABS.MIGRATE}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="mb-3 shrink-0 text-sm">
                  Add servers by uploading a JSON file or dragging and dropping
                  it here.
                </div>
                <div className="flex min-h-0 flex-1 flex-col">
                  <JsonUpload
                    value={migrateJsonContent}
                    onChange={handleMigrateJsonChange}
                    onFileUpload={() => {}}
                    onValidate={handleValidate}
                    fillHeight
                  />
                </div>
                {checkboxText && (
                  <div className="mt-2 flex shrink-0 items-center space-x-2">
                    <Checkbox
                      id="custom-add-checkbox"
                      checked={isCheckboxChecked}
                      onCheckedChange={(checked) =>
                        setIsCheckboxChecked(checked === true)
                      }
                    />
                    <label
                      htmlFor="custom-add-checkbox"
                      className="text-sm font-medium leading-none"
                    >
                      {checkboxText}
                    </label>
                  </div>
                )}
                <Separator className="my-4 shrink-0" />
              </CustomTabsContent>
            )}
          </CustomTabs>
        </div>
      </div>

      {isSaving && (
        <div className="mt-4 shrink-0 px-6">
          <div className="relative h-2 w-full animate-pulse overflow-hidden rounded-full bg-muted">
            <div className="absolute inset-0 animate-[shimmer_2s_ease-in-out_infinite] bg-linear-to-r from-transparent via-primary to-transparent" />
          </div>
        </div>
      )}
      {(activeTab === TABS.CUSTOM || activeTab === TABS.MIGRATE) && (
        <div className="flex w-full shrink-0 justify-between">
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
