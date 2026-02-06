import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  VisuallyHidden,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { AuthenticationDialog } from "./AuthenticationDialog";
import { EnvVarsEditor } from "./EnvVarsEditor";
import { useDeleteMcpServer, useEditMcpServer } from "@/data/mcp-server";
import { useInitiateServerAuth } from "@/data/server-auth";
import { useModalsStore, useSocketStore, socketStore } from "@/store";
import { usePermissions } from "@/data/permissions";
import McpIcon from "./SystemConnectivity/nodes/Mcpx_Icon.svg?react";
import PencilIcon from "@/icons/pencil_simple_icon.svg?react";
import TrashIcon from "@/icons/trash_icons.svg?react";
import ArrowRightIcon from "@/icons/arrow_line_rigth.svg?react";
import { McpServer, McpServerTool, EnvValue } from "@/types";
import { formatRelativeTime } from "@/utils";
import { Activity, Lock } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { Copyable } from "../ui/copyable";
import { useDomainIcon } from "@/hooks/useDomainIcon";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getStatusBackgroundColor,
  getStatusText,
  getStatusTextColor,
} from "./helpers";
import { SERVER_STATUS } from "@/types/mcp-server";
// TODO: McpServer type uses `command?: string` which loses type information.
// The proper fix is to preserve AllowedCommands type from the source (system state)
// so we don't need runtime validation here. For now, we validate at usage.
import { AllowedCommands } from "@mcpx/shared-model";

export const ServerDetailsModal = ({
  isOpen,
  onClose,
  server,
}: {
  isOpen: boolean;
  onClose: () => void;
  server: McpServer | null;
}) => {
  const { openEditServerModal } = useModalsStore((s) => ({
    openEditServerModal: s.openEditServerModal,
  }));
  const { hasPrivileges: hasAdminPrivileges } = usePermissions();

  const { mutate: deleteServer } = useDeleteMcpServer();
  const { mutate: initiateServerAuth } = useInitiateServerAuth();
  const { mutate: editServer, isPending: isEditPending } = useEditMcpServer();
  const { toast, dismiss } = useToast();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [userCode, setUserCode] = useState<string | null>(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const [authWindow, setAuthWindow] = useState<Window | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const [switchChecked, setSwitchChecked] = useState<boolean>(true);

  const { emitPatchAppConfig } = useSocketStore((s) => ({
    emitPatchAppConfig: s.emitPatchAppConfig,
  }));

  // Get appConfig reactively for isActive (will update when socket loads it)
  const appConfig = useSocketStore((s) => s.appConfig);

  // These hooks must be called unconditionally (before any early returns)
  const domainIconUrl = useDomainIcon(server?.name ?? null);

  // Compute effective status: if inactive from appConfig, override to connected_inactive
  const effectiveStatus = useMemo(() => {
    if (!server) return SERVER_STATUS.connected_stopped; // fallback, early return handles this
    if (!appConfig) return server.status;
    const serverAttributes = appConfig.targetServerAttributes?.[server.name];
    const isInactive = serverAttributes?.inactive === true;
    if (
      isInactive &&
      (server.status === SERVER_STATUS.connected_running ||
        server.status === SERVER_STATUS.connected_stopped)
    ) {
      return SERVER_STATUS.connected_inactive;
    }
    return server.status;
  }, [appConfig, server]);

  useEffect(() => {
    setInternalOpen(isOpen);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && server && appConfig) {
      const serverAttributes = appConfig.targetServerAttributes?.[server.name];
      setSwitchChecked(serverAttributes?.inactive !== true);
    }
  }, [isOpen, server, appConfig]);

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

  if (!server) return null;

  const handleToggle = async (checked: boolean) => {
    if (isToggling) {
      return;
    }

    const currentAppConfig = socketStore.getState().appConfig;

    // Guard: Check if appConfig is available from store
    if (!currentAppConfig) {
      return;
    }
    setSwitchChecked(checked);
    setIsToggling(true);

    try {
      // 2. Prepare updated config
      const currentTargetServerAttributes =
        currentAppConfig.targetServerAttributes ?? {};

      const updatedTargetServerAttributes = {
        ...currentTargetServerAttributes,
      };
      updatedTargetServerAttributes[server.name] = {
        ...updatedTargetServerAttributes[server.name],
        inactive: !checked, // checked=true means active, so inactive=false
      };

      const updatedConfig = {
        ...currentAppConfig,
        targetServerAttributes: updatedTargetServerAttributes,
      };

      await emitPatchAppConfig(updatedConfig);

      // handleClose();
    } catch (error) {
      console.log("ERROR", error);
      // 5. Error - revert switch state
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

  // Save env vars and retry connection
  const handleSaveEnv = (env: Record<string, EnvValue>) => {
    if (!server || server.type !== "stdio" || !server.command) return;

    const commandResult = AllowedCommands.safeParse(server.command);
    if (!commandResult.success) return;

    editServer(
      {
        name: server.name,
        payload: {
          type: "stdio",
          command: commandResult.data,
          args: server.args,
          env,
          icon: server.icon,
        },
      },
      {
        onSuccess: () => {
          toast({
            title: "Configuration Saved",
            description: "Server configuration updated. Reconnecting...",
          });
          handleClose();
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

  const handleEditServer = () => {
    dismiss(); // Dismiss all toasts when opening Edit Server modal

    const baseServer = {
      name: server.name,
      icon: server.icon,
      state: { type: "connected" } as const,
      tools: server.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        usage: {
          callCount: tool.invocations,
          lastCalledAt: tool.lastCalledAt
            ? new Date(tool.lastCalledAt)
            : undefined,
        },
        inputSchema: {
          type: "object" as const,
          properties: {},
        },
      })),
      originalTools: server.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: {
          type: "object" as const,
          properties: {},
        },
      })),
      usage: {
        callCount: server.usage.callCount,
        lastCalledAt: server.usage.lastCalledAt
          ? new Date(server.usage.lastCalledAt)
          : undefined,
      },
    };

    let targetServer;
    if (server.type === "stdio") {
      targetServer = {
        _type: "stdio" as const,
        ...baseServer,
        command: server.command || "",
        args: server.args,
        env: server.env,
      };
    } else {
      if (server.type === "sse") {
        targetServer = {
          _type: "sse" as const,
          ...baseServer,
          url: server.url || "",
          ...(server.headers && { headers: server.headers }),
        };
      } else {
        targetServer = {
          _type: "streamable-http" as const,
          ...baseServer,
          url: server.url || "",
          ...(server.headers && { headers: server.headers }),
        };
      }
    }
    openEditServerModal(targetServer);
    onClose();
  };

  const handleRemoveServer = () => {
    const toastObj = toast({
      title: "Remove Server",
      description: (
        <>
          Are you sure you want to remove{" "}
          <strong>
            {server.name.charAt(0).toUpperCase() + server.name.slice(1)}
          </strong>{" "}
          server?
        </>
      ),
      isClosable: true,
      duration: 1000000, // prevent toast disappear
      variant: "warning", // added new variant
      action: (
        <Button
          variant="danger"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            deleteServer(
              { name: server.name },
              {
                onSuccess: () => {
                  toastObj.dismiss();
                  onClose();
                },
                onError: (error) => {
                  toast({
                    title: "Error",
                    description: `Failed to remove server "${server.name}": ${error.message}`,
                    variant: "destructive",
                  });
                },
              },
            );
          }}
        >
          Ok
        </Button>
      ),
    });
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
        className="!w-[600px] !max-w-[600px] bg-white p-0 flex flex-col [&>button]:hidden"
      >
        <VisuallyHidden>
          <SheetTitle>{server.name}</SheetTitle>
        </VisuallyHidden>
        <SheetHeader className="px-6 py-4 flex flex-row justify-between items-center border-b gap-2">
          <div
            className={`inline-flex gap-1 items-center h-6 w-fit px-2 rounded-full text-xs font-medium  ${getStatusBackgroundColor(effectiveStatus)} ${getStatusTextColor(effectiveStatus)} `}
          >
            <div className="bg-current w-2 h-2 rounded-full"></div>
            {getStatusText(effectiveStatus)}
          </div>
          <div className="flex m-0! gap-1.5 items-center text-[#7F7999]">
            {hasAdminPrivileges && (
              <Button
                variant="ghost"
                size="icon"
                className="w-4 h-4"
                onClick={handleEditServer}
              >
                <PencilIcon />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="w-4 h-4"
              onClick={handleRemoveServer}
            >
              <TrashIcon />
            </Button>
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

        <div className="px-6 gap-4 flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {domainIconUrl ? (
                <img
                  src={domainIconUrl}
                  alt="Domain Icon"
                  className="min-w-12 w-12 min-h-12 h-12 rounded-xl object-contain p-2 bg-white"
                />
              ) : (
                <McpIcon
                  style={{ color: server.icon }}
                  className="min-w-12 w-12 min-h-12 h-12 rounded-md bg-white p-1"
                />
              )}
              <span className="text-2xl font-medium capitalize">
                {" "}
                {server.name}
              </span>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Switch
                      checked={switchChecked}
                      onCheckedChange={handleToggle}
                      disabled={isToggling || !appConfig}
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

          <div className="flex gap-4">
            <div className="flex-1 bg-white rounded-lg p-4 border border-gray-200">
              <div className="text-sm font-medium text-muted-foreground mb-1">
                Calls
              </div>
              <div className="text-lg font-medium text-foreground">
                {server.usage.callCount}
              </div>
            </div>

            <div className="flex-1 bg-white rounded-lg p-4 border border-gray-200">
              <div className="text-sm font-medium text-muted-foreground mb-1">
                Last Call
              </div>
              <div className="text-lg font-medium text-foreground">
                {server.usage.lastCalledAt
                  ? formatRelativeTime(
                      new Date(server.usage.lastCalledAt).getTime(),
                    )
                  : "N/A"}
              </div>
            </div>
          </div>

          <Separator className="" />
          <div className="">
            {server.status === "connection_failed" && server.connectionError ? (
              <div
                style={{ background: "#E402610F" }}
                className="bg-red-50 border border-[#E40261] rounded-lg p-4 mb-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-full flex items-center justify-center flex-col">
                    <div className="my-4">
                      <img src="/icons/warningRect.png" alt="warning" />
                    </div>

                    <div
                      style={{ color: "#E40261" }}
                      className="font-bold mb-4"
                    >
                      Connection Error
                    </div>
                    <div style={{ color: "#E40261" }}>
                      {" "}
                      Failed to initiate server:
                    </div>
                    <div style={{ color: "#E40261" }}>
                      inspect logs for more details
                    </div>
                  </div>
                </div>
              </div>
            ) : server.status === "pending_auth" ? (
              <div className="flex gap-2 flex-col justify-center items-center bg-card border rounded-lg p-4 mb-4">
                <div className="text-sm font-semibold text-foreground">
                  No tools available
                </div>
                <div className="text-sm font-normal text-foreground">
                  It seems you haven't connected...
                </div>
                {userCode && (
                  <span className="basis-full text-xs text-orange-700 bg-orange-100 rounded px-2 py-1">
                    Your code, click to copy: <Copyable value={userCode} />
                  </span>
                )}
                <div className="flex gap-2 mt-2">
                  {isAuthenticating ? (
                    <Button
                      variant="primary"
                      size="sm"
                      className="bg-[#5147E4]"
                      onClick={() => {
                        setIsAuthenticating(false);
                        if (authWindow && !authWindow.closed) {
                          authWindow.close();
                        }
                        setAuthWindow(null);
                        setUserCode(null);
                      }}
                    >
                      Cancel
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      className="bg-[#5147E4]"
                      onClick={() => handleAuthenticate(server.name)}
                    >
                      <Lock className="w-3 h-3 mr-1" />
                      Authenticate
                    </Button>
                  )}
                </div>
              </div>
            ) : server.status === "pending_input" && server.env ? (
              <EnvVarsEditor
                env={server.env}
                missingEnvVars={server.missingEnvVars}
                onSave={handleSaveEnv}
                isSaving={isEditPending}
              />
            ) : (
              server.tools?.length > 0 && (
                <div>
                  <div className="text-xl px-4 pb-2 font-medium text-foreground mb-1">
                    Tools ({server.tools.length})
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-[var(--color-border-primary)]">
                    <div className="flex flex-wrap gap-2">
                      {server.tools.map(
                        (tool: McpServerTool, index: number) => (
                          <div
                            key={`${tool.name}_${index}`}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-[var(--color-bg-container)] text-[var(--color-text-primary)] rounded-md text-xs font-medium border border-[var(--color-border-primary)]"
                          >
                            <span>{tool.name}</span>
                            {tool.invocations > 0 && (
                              <div className="flex items-center gap-1">
                                <Activity className="w-2 h-2" />
                                <span className="text-[10px] opacity-75">
                                  {tool.invocations}
                                </span>
                              </div>
                            )}
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        {/* <SheetFooter className="p-6 pt-4 !justify-start !flex-row">
          <Button
            variant="secondary"
            onClick={handleClose}
            className="border-[var(--color-border-interactive)] text-[var(--color-fg-interactive)] hover:bg-[var(--color-bg-interactive-hover)]"
          >
            Cancel
          </Button>
        </SheetFooter> */}
      </SheetContent>
      <AuthenticationDialog
        userCode={userCode}
        onClose={() => setUserCode(null)}
      />
    </Sheet>
  );
};
