import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";
import { useDeleteMcpServer } from "@/data/mcp-server";
import { useInitiateServerAuth } from "@/data/server-auth";
import { useModalsStore } from "@/store";
import McpIcon from "./SystemConnectivity/nodes/Mcpx_Icon.svg?react";
import PencilIcon from "@/icons/pencil_simple_icon.svg?react";
import TrashIcon from "@/icons/trash_icons.svg?react";
import ArrowRightIcon from "@/icons/arrow_line_rigth.svg?react";
import { McpServer, McpServerTool } from "@/types";
import { formatRelativeTime } from "@/utils";
import {
  Activity,
  ArrowRightToLine,
  Dot,
  Edit,
  Lock,
  Pencil,
  Server,
  Trash2,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Copyable } from "../ui/copyable";
import { data } from "react-router-dom";
import { useDomainIcon } from "@/hooks/useDomainIcon";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

  const { mutate: deleteServer } = useDeleteMcpServer();
  const { mutate: initiateServerAuth } = useInitiateServerAuth();
  const { toast } = useToast();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [userCode, setUserCode] = useState<string | null>(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const [authWindow, setAuthWindow] = useState<Window | null>(null);

  useEffect(() => {
    setInternalOpen(isOpen);
  }, [isOpen]);

  useEffect(() => {
    if (!authWindow) return;

    const checkWindow = setInterval(() => {
      try {
        if (authWindow.closed) {
          clearInterval(checkWindow);
          setIsAuthenticating(false);
          setAuthWindow(null);
          handleClose();
        }
      } catch (error) {
        clearInterval(checkWindow);
        setIsAuthenticating(false);
        setAuthWindow(null);
        handleClose();
      }
    }, 500);

    const timeout = setTimeout(() => {
      setIsAuthenticating(false);
      setAuthWindow(null);
      toast({
        title: "Authentication Timeout",
        description: "Please refresh the page to check authentication status.",
        variant: "destructive",
      });
    }, 120000);

    return () => {
      clearInterval(checkWindow);
      clearTimeout(timeout);
    };
  }, [authWindow, toast, server?.name, server?.status]);

  if (!server) return null;

  const handleEditServer = () => {
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
        };
      } else {
        targetServer = {
          _type: "streamable-http" as const,
          ...baseServer,
          url: server.url || "",
        };
      }
      if (server.headers) {
        targetServer["headers"] = server.headers;
      }
    }
    openEditServerModal(targetServer);
    onClose();
  };

  const handleRemoveServer = () => {
   let toastObj =  toast({
      title: "Remove Server",
      description: `Are you sure you want to remove ${server.name} server?`,
      isClosable: true,
      duration : 1000000, // prevent toast disappear
      variant:"warning", // added new variant
      action: (
        <Button
          variant="warning"
          onClick={() => {

            setTimeout(()=>{ onClose();}, 1000)
            deleteServer(
              { name: server.name },
              {
                onSuccess: () => {
                  toastObj.dismiss(toastObj.id)
                  onClose()
                },
                onError: (error) => {
                  // toast({
                  //   title: "Error",
                  //   description: `Failed to remove server "${server.name}": ${error.message}`,
                  //   variant: "destructive",
                  // });

                },
              },
            );
          }}
        >
          Ok
        </Button>
      ),
      position: "top-center",
    });

   console.log("REZ" , res)

  };

  const handleAuthenticate = (serverName: string) => {
    setIsAuthenticating(true);
    initiateServerAuth(
      { serverName },
      {
        onSuccess: ({ msg, authorizationUrl, userCode }) => {
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
            setUserCode(userCode);
            toast({
              title: "Authentication Started",
              description: (
                <div>
                  <p>
                    Please complete the authentication in the opened window.
                  </p>
                  <p className="mt-2">
                    Your device code: <Copyable value={userCode} />
                  </p>
                </div>
              ),
            });
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

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case "connected_running":
        return "text-[#00B271]";
      case "connected_stopped":
        return "text-[#00B271]";
      case "pending_auth":
        return "text-[#FF9500]";
      case "connection_failed":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getStatusBackgroundColor = (status: string) => {
    switch (status) {
      case "connected_running":
        return "bg-[#00B2711A]";
      case "connected_stopped":
        return "bg-[#00B2711A]";
      case "pending_auth":
        return "bg-[#FF95001A]";
      case "connection_failed":
        return "bg-red-100";
      default:
        return "bg-gray-100";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "connected_running":
        return "ACTIVE";
      case "connected_stopped":
        return "Connected";
      case "pending_auth":
        return "Pending Authentication";
      case "connection_failed":
        return "Connection Error";
      default:
        return "UNKNOWN";
    }
  };

  const handleClose = () => {
    if (authWindow && !authWindow.closed) {
      authWindow.close();
      setAuthWindow(null);
    }
    setIsAuthenticating(false);
    setInternalOpen(false);
    setTimeout(() => onClose(), 300); // Allow animation to complete
  };

  const domainIconUrl = useDomainIcon(server.name);

  return (
    <Sheet open={internalOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent
        aria-describedby={undefined}
        side="right"
        className="!w-[600px] !max-w-[600px] bg-white p-0 flex flex-col [&>button]:hidden"
      >

        <SheetHeader className="px-6 py-4 flex flex-row justify-between items-center border-b gap-2">
          <div
            className={`inline-flex gap-1 items-center h-6 w-fit px-2 rounded-full text-xs font-medium  ${getStatusBackgroundColor(server.status)} ${getStatusTextColor(server.status)} `}
          >
            <div className="bg-current w-2 h-2 rounded-full"></div>
            {getStatusText(server.status)}
          </div>
          <div className="flex m-0! gap-1.5 items-center text-[#7F7999]">
            <Button
              variant="ghost"
              size="icon"
              className="w-4 h-4"
              onClick={handleEditServer}
            >
              <PencilIcon />
            </Button>
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
          <div className="flex items-center gap-2">
            {domainIconUrl ? (
              <img
                src={domainIconUrl}
                alt="Domain Icon"
                className="min-w-12 w-12 min-h-12 h-12 rounded-xl object-contain p-2 bg-white"
              />
            ) : (
              <McpIcon style={{ color: server.icon }} className="min-w-12 w-12 min-h-12 h-12 rounded-md bg-white p-1" />
            )}
            <span className="text-2xl font-medium capitalize"> {server.name}</span>
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
              <div style={{ background: "#E402610F" }} className="bg-red-50 border border-[#E40261] rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <div

                    className="w-full flex items-center justify-center flex-col"
                  >
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
                  It seems you haven't connect...
                </div>
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
    </Sheet>
  );
};
