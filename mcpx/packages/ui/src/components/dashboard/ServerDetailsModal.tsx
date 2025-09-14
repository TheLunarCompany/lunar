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
import { McpServer, McpServerTool } from "@/types";
import { formatRelativeTime } from "@/utils";
import { Activity, Edit, Lock, Server, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Copyable } from "../ui/copyable";

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
    if (
      window.confirm(`Are you sure you want to remove server "${server.name}"?`)
    ) {
      deleteServer(
        { name: server.name },
        {
          onSuccess: () => {
            toast({
              title: "Server Removed",
              description: `Server "${server.name}" was removed successfully.`,
            });
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
    }
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
        return "text-green-600";
      case "connected_stopped":
        return "text-green-600";
      case "pending_auth":
        return "text-yellow-600";
      case "connection_failed":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getStatusBorderColor = (status: string) => {
    switch (status) {
      case "connected_running":
        return "border-green-600";
      case "connected_stopped":
        return "border-green-600";
      case "pending_auth":
        return "border-yellow-500";
      case "connection_failed":
        return "border-red-600";
      default:
        return "border-gray-600";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "connected_running":
        return "ACTIVE ";
      case "connected_stopped":
        return "IDLE";
      case "pending_auth":
        return "PENDING";
      case "connection_failed":
        return "FAILED";
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

  return (
    <Sheet open={internalOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent
        side="right"
        className="!w-[500px] !max-w-[500px] bg-[var(--color-bg-container)] p-0 flex flex-col [&>button]:hidden"
      >
        <SheetHeader className="p-6 pb-4">
          <SheetTitle className="flex items-center gap-2 text-xl text-[var(--color-text-primary)]">
            <Server className="w-5 h-5 text-[var(--color-fg-interactive)]" />
            {server.name}
            {/* Authenticated tag for remote servers */}
            {(server.type === "sse" || server.type === "streamable-http") &&
              (server.status === "connected_running" ||
                server.status === "connected_stopped") && (
                <div className="inline-flex items-center px-2 py-1 bg-white text-green-600 rounded-full text-xs font-medium border border-green-600 ml-2">
                  Authenticated
                </div>
              )}
            {/* Status badge for all servers */}
            <div
              className={`inline-flex items-center ${server.status === "connected_stopped" ? "px-4" : "px-2"} py-1 rounded-full text-xs font-medium bg-white border ${getStatusBorderColor(server.status)} ${getStatusTextColor(server.status)} ml-2`}
            >
              {getStatusText(server.status)}
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="px-6 pb-4 flex-1 overflow-y-auto">
          {/* Server Overview Cards */}
          <div className="flex gap-4 mb-4">
            {/* Calls Card */}
            <div className="flex-1 bg-white rounded-lg p-4 border border-gray-200">
              <div className="text-sm font-medium text-gray-600 mb-1">
                Calls
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {server.usage.callCount}
              </div>
            </div>

            {/* Last Call Card */}
            <div className="flex-1 bg-white rounded-lg p-4 border border-gray-200">
              <div className="text-sm font-medium text-gray-600 mb-1">
                Last Call
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {server.usage.lastCalledAt
                  ? formatRelativeTime(
                      new Date(server.usage.lastCalledAt).getTime(),
                    )
                  : "N/A"}
              </div>
            </div>
          </div>

          {/* Tools Section */}
          <div className="mb-6">
            <div className="flex items-center gap-2 justify-center mt-10 px-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleEditServer}
                className="flex-1 border-[var(--color-border-interactive)] text-[var(--color-fg-interactive)] hover:!text-[var(--color-fg-interactive)] hover:bg-[var(--color-bg-interactive-hover)] justify-center"
              >
                <Edit className="w-3 h-3 mr-1" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemoveServer}
                className="flex-1 border-red-500 text-red-500 hover:!text-red-500 hover:bg-red-100 hover:border-red-600 justify-center"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Remove
              </Button>
            </div>

            {server.status === "connection_failed" && server.connectionError ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 mt-10">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-sm font-medium text-red-800">
                    Connection Error
                  </span>
                </div>
                <div className="text-xs text-red-700 bg-red-100 rounded p-3 font-mono">
                  {server.connectionError}
                </div>
              </div>
            ) : server.status === "pending_auth" ? (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4 mt-10">
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-orange-800">
                      Pending Authentication
                    </span>

                    {userCode && (
                      <span className="basis-full text-xs text-orange-700 bg-orange-100 rounded px-2 py-1">
                        Your code, click to copy: <Copyable value={userCode} />
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {isAuthenticating ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsAuthenticating(false);
                          if (authWindow && !authWindow.closed) {
                            authWindow.close();
                          }
                          setAuthWindow(null);
                        }}
                        className="border-gray-500 hover:bg-white text-gray-700 hover:enabled:text-gray-700 px-4"
                      >
                        Cancel
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAuthenticate(server.name)}
                        className="border-orange-500 hover:bg-white text-orange-700 hover:enabled:text-orange-700 px-6"
                      >
                        <Lock className="w-3 h-3 mr-1" />
                        Authenticate
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ) : server.tools && server.tools.length > 0 ? (
              <div className="bg-[var(--color-bg-container-overlay)] rounded-lg p-4 border border-[var(--color-border-primary)] mt-10">
                <div className="flex flex-wrap gap-2">
                  {server.tools.map((tool: McpServerTool, index: number) => (
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
                  ))}
                </div>
                {/*count of tools*/}
                <div className="text-[10px] opacity-75 mt-4 text-left ml-2">
                  {server.tools.length} tools
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <Separator className="mx-6" />

        <SheetFooter className="p-6 pt-4 !justify-start !flex-row">
          <Button
            variant="outline"
            onClick={handleClose}
            className="border-[var(--color-border-interactive)] text-[var(--color-fg-interactive)] hover:bg-[var(--color-bg-interactive-hover)]"
          >
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
