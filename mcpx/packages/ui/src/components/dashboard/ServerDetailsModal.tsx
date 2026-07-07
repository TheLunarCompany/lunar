import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { VisuallyHidden as VisuallyHiddenPrimitive } from "radix-ui";
const VisuallyHidden = VisuallyHiddenPrimitive.Root;
import { useToast } from "@/components/ui/use-toast";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { AuthenticationDialog } from "./AuthenticationDialog";
import { EnvVarsEditor, HeadersEditor } from "./EnvVarsEditor";
import {
  useDeleteMcpServer,
  useEditMcpServer,
  useSetTargetServerActive,
} from "@/data/mcp-server";
import { useInitiateServerAuth } from "@/data/server-auth";
import { useDashboardStore, useModalsStore, useSocketStore } from "@/store";
import { usePermissions } from "@/data/permissions";
import PencilIcon from "@/icons/pencil_simple_icon.svg?react";
import TrashIcon from "@/icons/trash_icons.svg?react";
import ArrowRightIcon from "@/icons/arrow_line_rigth.svg?react";
import { McpServer, McpServerStatus, EnvValue } from "@/types";
import { formatRelativeTime } from "@/utils";
import { ChevronDown, Loader2 } from "lucide-react";
import { ServerToolsList } from "./ServerToolsList";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useEffect, useState, useMemo } from "react";
import { useDomainIcon } from "@/hooks/useDomainIcon";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SERVER_STATUS } from "@/types/mcp-server";
import { getEditTargetServer } from "./server-edit-target";
// TODO: McpServer type uses `command?: string` which loses type information.
// The proper fix is to preserve AllowedCommands type from the source (system state)
// so we don't need runtime validation here. For now, we validate at usage.
import { AllowedCommands } from "@mcpx/shared-model";
import { useGetMCPServers } from "@/data/catalog-servers";
import { normalizeServerName } from "@mcpx/toolkit-ui/src/utils/server-helpers";
import { findMcpServerByName } from "@/mapping/system-state";
import { ServerMetricCards } from "./ServerMetricCards";
import {
  AuthenticationRequiredCard,
  ConnectionErrorCard,
  PendingInputCard,
} from "./ServerStateCards";
import { ServerStatusBadge } from "./ServerStatusBadge";
import { ServerPromptsList } from "./ServerToolsList";
import { isCapabilitiesEnabled } from "@/config/runtime-config";

const DRAWER_SHEET_CLASS_NAME =
  "w-[600px]! max-w-[600px]! bg-white p-0 flex flex-col [&>button]:hidden";

export function ServerCapabilitiesSections({
  server,
}: {
  server: McpServer;
}): React.JSX.Element {
  const showPrompts = isCapabilitiesEnabled();

  return (
    <>
      {server.tools?.length > 0 && (
        <Collapsible
          defaultOpen
          className="rounded-lg border border-border p-4 mb-4"
        >
          <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between text-sm font-semibold text-foreground">
            Tools ({server.tools.length})
            <ChevronDown className="h-4 w-4 transition-transform [[data-state=open]>&]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="pt-3">
              <ServerToolsList tools={server.tools} />
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
      {showPrompts && (server.prompts?.length ?? 0) > 0 && (
        <Collapsible
          defaultOpen
          className="rounded-lg border border-border p-4 mb-4"
        >
          <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between text-sm font-semibold text-foreground">
            Prompts ({server.prompts?.length})
            <ChevronDown className="h-4 w-4 transition-transform [[data-state=open]>&]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="pt-3">
              <ServerPromptsList prompts={server.prompts ?? []} />
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </>
  );
}

export const ServerDetailsModal = ({
  isOpen,
  onClose,
  serverName,
}: {
  isOpen: boolean;
  onClose: () => void;
  serverName: string | null;
}) => {
  const { openEditServerModal, serverDetailsOpenedFromInsertValueButton } =
    useModalsStore((s) => ({
      openEditServerModal: s.openEditServerModal,
      serverDetailsOpenedFromInsertValueButton:
        s.serverDetailsOpenedFromInsertValueButton,
    }));
  const setOptimisticallyRemovedServerName = useDashboardStore(
    (s) => s.setOptimisticallyRemovedServerName,
  );
  const { canAddCustomServerAndEdit: canEditCustom } = usePermissions();

  const { mutate: deleteServer } = useDeleteMcpServer();
  const { mutate: initiateServerAuth } = useInitiateServerAuth();
  const { mutate: editServer, isPending: isEditPending } = useEditMcpServer();
  const { data: catalogServers } = useGetMCPServers();
  const { toast, dismiss } = useToast();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [userCode, setUserCode] = useState<string | null>(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const [authWindow, setAuthWindow] = useState<Window | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const [switchChecked, setSwitchChecked] = useState<boolean>(true);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const { mutateAsync: setTargetServerActiveAsync } =
    useSetTargetServerActive();

  const systemState = useSocketStore((s) => s.systemState);
  const detailsServer = useMemo(
    () => findMcpServerByName(systemState, serverName),
    [serverName, systemState],
  );

  const catalogMatchingServer = useMemo(() => {
    if (!detailsServer || !catalogServers) return undefined;
    const normalizedName = normalizeServerName(detailsServer.name);
    return catalogServers.find(
      (s) => normalizeServerName(s.name) === normalizedName,
    );
  }, [detailsServer, catalogServers]);

  const envRequirements = useMemo(() => {
    if (
      !detailsServer ||
      !detailsServer.env ||
      !catalogMatchingServer ||
      !(Object.keys(detailsServer.env).length > 0)
    )
      return undefined;

    const serverConfig =
      catalogMatchingServer.config[catalogMatchingServer.name];
    if (serverConfig.type === "stdio") {
      return serverConfig.env;
    } else {
      return undefined;
    }
  }, [detailsServer, catalogMatchingServer]);

  // Get appConfig reactively for activation state (will update when socket loads it)
  const appConfig = useSocketStore((s) => s.appConfig);

  // These hooks must be called unconditionally (before any early returns)
  const domainIconUrl = useDomainIcon(detailsServer?.name ?? "");

  // Status from the live-overlaid server keeps the drawer reactive as server state transitions.
  const liveStatus: McpServerStatus = useMemo(() => {
    return detailsServer?.status ?? SERVER_STATUS.connected_stopped;
  }, [detailsServer]);

  // Compute effective status: if inactive from appConfig, override to connected_inactive
  const effectiveStatus = useMemo(() => {
    if (!detailsServer) return SERVER_STATUS.connected_stopped; // fallback, early return handles this
    if (!appConfig) return liveStatus;
    const serverAttributes =
      appConfig.targetServerAttributes?.[detailsServer.name];
    const isInactive = serverAttributes?.inactive === true;
    if (
      isInactive &&
      (liveStatus === SERVER_STATUS.connected_running ||
        liveStatus === SERVER_STATUS.connected_stopped)
    ) {
      return SERVER_STATUS.connected_inactive;
    }
    return liveStatus;
  }, [appConfig, detailsServer, liveStatus]);
  useEffect(() => {
    setInternalOpen(isOpen);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && detailsServer && appConfig) {
      const serverAttributes =
        appConfig.targetServerAttributes?.[detailsServer.name];
      setSwitchChecked(serverAttributes?.inactive !== true);
    }
  }, [isOpen, detailsServer, appConfig]);

  useEffect(() => {
    if (!authWindow) return;

    const checkWindow = setInterval(() => {
      try {
        if (authWindow.closed) {
          clearInterval(checkWindow);
          setIsAuthenticating(false);
          setAuthWindow(null);
        }
      } catch (_error) {
        clearInterval(checkWindow);
        setIsAuthenticating(false);
        setAuthWindow(null);
      }
    }, 500);

    return () => {
      clearInterval(checkWindow);
    };
  }, [authWindow]);

  if (!detailsServer) return null;

  const currentServer = detailsServer;

  const handleToggle = async (checked: boolean) => {
    if (isToggling) {
      return;
    }

    setSwitchChecked(checked);
    setIsToggling(true);

    try {
      await setTargetServerActiveAsync({
        name: currentServer.name,
        active: checked,
      });
    } catch (error) {
      // Revert the optimistic switch state on failure.
      setSwitchChecked(!checked);
      toast({
        title: "Error",
        description: `Failed to ${checked ? "activate" : "deactivate"} server: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      });
    } finally {
      setIsToggling(false);
    }
  };

  // Save env vars and retry connection. Closes drawer on success by default.
  const handleSaveEnv = (
    env: Record<string, EnvValue>,
    options?: { closeDrawer?: boolean },
  ) => {
    if (currentServer.type !== "stdio" || !currentServer.command) return;

    const commandResult = AllowedCommands.safeParse(currentServer.command);
    if (!commandResult.success) return;

    const shouldCloseDrawer = options?.closeDrawer !== false;

    editServer(
      {
        name: currentServer.name,
        payload: {
          catalogItemId: currentServer.catalogItemId,
          type: "stdio",
          command: commandResult.data,
          args: currentServer.args,
          env,
          icon: currentServer.icon,
        },
      },
      {
        onSuccess: () => {
          toast({
            title: "Configuration Saved",
            description: "Server configuration updated. Reconnecting...",
          });
          if (shouldCloseDrawer) handleClose();
        },
        onError: (error) => {
          toast({
            title: "Error",
            description: `Failed to save configuration: ${error.message}`,
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleSaveHeaders = (headers: Record<string, EnvValue>) => {
    if (
      currentServer.type !== "sse" &&
      currentServer.type !== "streamable-http"
    )
      return;
    if (!currentServer.url) return;

    editServer(
      {
        name: currentServer.name,
        payload: {
          catalogItemId: currentServer.catalogItemId,
          type: currentServer.type,
          url: currentServer.url,
          headers,
          icon: currentServer.icon,
        },
      },
      {
        onSuccess: () => {
          toast({
            title: "Headers Saved",
            description: "Server headers updated.",
          });
          handleClose();
        },
        onError: (error) => {
          toast({
            title: "Error",
            description: `Failed to save headers: ${error.message}`,
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleEditServer = () => {
    dismiss(); // Dismiss all toasts when opening Edit Server modal
    openEditServerModal(getEditTargetServer(currentServer));
    onClose();
  };

  const handleRemoveServer = () => setIsDeleteConfirmOpen(true);

  const handleConfirmRemoveServer = () => {
    deleteServer(
      { name: currentServer.name },
      {
        onSuccess: () => {
          setOptimisticallyRemovedServerName(currentServer.name);
          setIsDeleteConfirmOpen(false);
          onClose();
        },
        onError: (error) => {
          toast({
            title: "Error",
            description: `Failed to remove server "${currentServer.name}": ${error.message}`,
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleAuthenticate = (serverName: string) => {
    setIsAuthenticating(true);
    initiateServerAuth(
      { serverName },
      {
        onSuccess: ({ authorizationUrl, userCode }) => {
          if (authorizationUrl) {
            const normalizedUrl = new URL(authorizationUrl);
            const url = normalizedUrl.toString();
            const newAuthWindow = window.open(
              url,
              "mcpx-auth-popup",
              "width=600,height=700,popup=true",
            );
            if (newAuthWindow) {
              newAuthWindow.focus();
              setAuthWindow(newAuthWindow);
            } else {
              setIsAuthenticating(false);
              toast({
                title: "Authentication Error",
                description:
                  "Failed to open authentication window. Please check your popup blocker settings.",
                variant: "destructive",
              });
            }
          } else {
            setIsAuthenticating(false);
            toast({
              title: "Authentication Error",
              description: "No authorization URL received from server.",
              variant: "destructive",
            });
          }
          if (userCode) {
            dismiss(); // Dismiss any existing toasts
            setUserCode(userCode);
          }
        },
        onError: (error) => {
          setIsAuthenticating(false);
          toast({
            title: "Authentication Failed",
            description: `Failed to initiate authentication: ${error.message}`,
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleClose = () => {
    dismiss(); // Dismiss all toasts when closing Server Details modal
    if (authWindow && authWindow.closed) {
      setAuthWindow(null);
    }
    setIsAuthenticating(false);
    // Clear userCode when modal closes (component will unmount anyway)
    setUserCode(null);
    setInternalOpen(false);
    setTimeout(() => onClose(), 300);
  };

  return (
    <Sheet open={internalOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent
        aria-describedby={undefined}
        side="right"
        className={DRAWER_SHEET_CLASS_NAME}
      >
        <VisuallyHidden>
          <SheetTitle>{currentServer.name}</SheetTitle>
        </VisuallyHidden>
        <ConfirmDeleteDialog
          isOpen={isDeleteConfirmOpen}
          onClose={() => setIsDeleteConfirmOpen(false)}
          onConfirm={handleConfirmRemoveServer}
          title={`Are you sure you want to remove ${currentServer.name.charAt(0).toUpperCase() + currentServer.name.slice(1)} server?`}
          confirmButtonText="Delete"
          cancelButtonText="Cancel"
        >
          <>
            <SheetHeader className="px-6 py-4 flex flex-row justify-between items-center border-b gap-2 shrink-0">
              <ServerStatusBadge status={effectiveStatus} />
              <div className="flex m-0! gap-1.5 items-center text-[#7F7999]">
                {liveStatus !== "connecting" && canEditCustom && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-4 h-4"
                    onClick={handleEditServer}
                  >
                    <PencilIcon />
                  </Button>
                )}
                {liveStatus !== "connecting" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-4 h-4"
                    onClick={handleRemoveServer}
                  >
                    <TrashIcon />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-4 h-4"
                  onClick={handleClose}
                >
                  <ArrowRightIcon />
                </Button>
              </div>
            </SheetHeader>

            <div className="px-6 gap-4 flex flex-col overflow-y-auto flex-1 min-h-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <img
                    src={domainIconUrl}
                    alt="Domain Icon"
                    className="min-w-12 w-12 min-h-12 h-12 rounded-xl object-contain p-2 bg-white"
                  />
                  <span className="text-2xl font-medium capitalize">
                    {" "}
                    {currentServer.name}
                  </span>

                  <p className="text-[11px] w-fit text-muted-foreground border border-muted-foreground rounded-[4px] px-1 py-1 m-0 leading-none">
                    {currentServer.catalogItemId || catalogMatchingServer?.id
                      ? "Approved Server From Catalog"
                      : "Custom Server"}
                  </p>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Switch
                          checked={switchChecked}
                          onCheckedChange={handleToggle}
                          disabled={
                            isToggling ||
                            !appConfig ||
                            liveStatus === "connecting"
                          }
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        {!appConfig
                          ? "Waiting for configuration to load..."
                          : "Activate/Inactivate"}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <ServerMetricCards
                calls={currentServer.usage.callCount}
                lastCall={
                  currentServer.usage.lastCalledAt
                    ? formatRelativeTime(
                        new Date(currentServer.usage.lastCalledAt).getTime(),
                      )
                    : "N/A"
                }
              />

              {effectiveStatus === "pending_input" && (
                <PendingInputCard testId="pending-user-input-banner" />
              )}
              <div className="">
                {liveStatus === "connecting" ? (
                  <div className="flex gap-2 flex-col justify-center items-center bg-card border rounded-lg p-4 mb-4">
                    <Loader2 className="w-6 h-6 animate-spin text-[#6B7280]" />
                    <div className="text-sm font-semibold text-[#6B7280]">
                      Connecting...
                    </div>
                  </div>
                ) : liveStatus === "connection_failed" &&
                  currentServer.connectionError ? (
                  <>
                    <ConnectionErrorCard />
                    {currentServer.env &&
                      currentServer.type === "stdio" &&
                      Object.keys(currentServer.env).length > 0 && (
                        <EnvVarsEditor
                          env={currentServer.env}
                          requirements={envRequirements}
                          missingEnvVars={currentServer.missingEnvVars}
                          onSave={(env) => handleSaveEnv(env)}
                          isSaving={isEditPending}
                        />
                      )}
                    {currentServer.headers &&
                      currentServer.type !== "stdio" &&
                      Object.keys(currentServer.headers).length > 0 && (
                        <HeadersEditor
                          headers={currentServer.headers}
                          onSave={handleSaveHeaders}
                          isSaving={isEditPending}
                          missingEnvVars={currentServer.missingEnvVars}
                        />
                      )}
                  </>
                ) : liveStatus === "pending_auth" ? (
                  <div className="flex flex-col gap-3">
                    <AuthenticationRequiredCard
                      authWindow={authWindow}
                      isAuthenticating={isAuthenticating}
                      onAuthenticate={() =>
                        handleAuthenticate(currentServer.name)
                      }
                      setAuthWindow={setAuthWindow}
                      setIsAuthenticating={setIsAuthenticating}
                      setUserCode={setUserCode}
                      userCode={userCode}
                    />
                    {currentServer.headers &&
                      currentServer.type !== "stdio" &&
                      Object.keys(currentServer.headers).length > 0 && (
                        <HeadersEditor
                          headers={currentServer.headers}
                          onSave={handleSaveHeaders}
                          isSaving={isEditPending}
                          missingEnvVars={currentServer.missingEnvVars}
                        />
                      )}
                    <ServerCapabilitiesSections server={currentServer} />
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {currentServer.env &&
                      currentServer.type === "stdio" &&
                      Object.keys(currentServer.env).length > 0 && (
                        <Collapsible
                          defaultOpen
                          className="rounded-lg border border-border p-4"
                        >
                          <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between text-sm font-semibold text-foreground">
                            Environment Variables
                            <ChevronDown className="h-4 w-4 transition-transform [[data-state=open]>&]:rotate-180" />
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div
                              className={
                                effectiveStatus === "pending_input" &&
                                serverDetailsOpenedFromInsertValueButton
                                  ? "pt-3 rounded-lg p-4 border border-[#5147E4] shadow-xl shadow-[#5147E4]/30"
                                  : "pt-3"
                              }
                            >
                              <EnvVarsEditor
                                env={currentServer.env}
                                requirements={envRequirements}
                                missingEnvVars={currentServer.missingEnvVars}
                                onSave={(env) => handleSaveEnv(env)}
                                isSaving={isEditPending}
                                hideTitle
                              />
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    {currentServer.headers &&
                      currentServer.type !== "stdio" &&
                      Object.keys(currentServer.headers).length > 0 && (
                        <Collapsible
                          defaultOpen
                          className="rounded-lg border border-border p-4"
                        >
                          <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between text-sm font-semibold text-foreground">
                            Headers
                            <ChevronDown className="h-4 w-4 transition-transform [[data-state=open]>&]:rotate-180" />
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="pt-3">
                              <HeadersEditor
                                headers={currentServer.headers}
                                onSave={handleSaveHeaders}
                                isSaving={isEditPending}
                                hideTitle
                                missingEnvVars={currentServer.missingEnvVars}
                              />
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    <ServerCapabilitiesSections server={currentServer} />
                  </div>
                )}
              </div>
            </div>
          </>
        </ConfirmDeleteDialog>
      </SheetContent>
      <AuthenticationDialog
        userCode={userCode}
        serverStatus={liveStatus}
        onClose={() => setUserCode(null)}
      />
    </Sheet>
  );
};
