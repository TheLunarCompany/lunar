import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Handle, NodeProps, Position } from "@xyflow/react";
import McpIcon from "./Mcpx_Icon.svg?react";
import { memo, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { McpServerNode } from "../types";
import { Button } from "@/components/ui/button";
import { useInitiateServerAuth } from "@/data/server-auth";
import { useToast } from "@/components/ui/use-toast";
import { MCP_ICON_COLORS } from "./constants";
import { SERVER_STATUS } from "@/types/mcp-server";
import { useDomainIcon } from "@/hooks/useDomainIcon";
import { AuthenticationDialog } from "../../AuthenticationDialog";

const McpServerNodeRenderer = ({
  data,
  isConnectable,
}: NodeProps<McpServerNode>) => {
  const { mutate: initiateServerAuth } = useInitiateServerAuth();
  const { toast, dismiss } = useToast();
  const [userCode, setUserCode] = useState<string | null>(null);

  const { status } = data;
  const domainIconUrl = useDomainIcon(data.name);

  const isShowErrorFrame =
    data.tools?.length == 0 && status === SERVER_STATUS.connection_failed;

  const iconColor = useMemo(() => {
    if (status === SERVER_STATUS.connected_inactive) return "#C3C4CD";
    const hash = data.name
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return MCP_ICON_COLORS[hash % MCP_ICON_COLORS.length];
  }, [status, data.name]);

  return (
    <motion.div>
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-transparent"
        isConnectable={isConnectable}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.5 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <div
          className="flex flex-col items-center relative"
          id={`server-${data.id}`}
        >
          {isShowErrorFrame && (
            <div className="absolute right-[6px] top-[6px] flex items-center">
              <img
                alt="Warning"
                className="w-3 h-3"
                src="/icons/warningCircle.png"
              />
            </div>
          )}

          <Card
            className={cn(
              "rounded border bg-[#F6F4FE] cursor-pointer h-[90px] w-[190px] flex flex-col gap-1 transition-all p-4 duration-300 hover:shadow-sm",
              status === SERVER_STATUS.connected_running
                ? "border-[#B4108B] shadow-lg shadow-[#B4108B]/40"
                : status === SERVER_STATUS.connected_inactive
                  ? "border-[#C3C4CD]"
                  : "border-[#D8DCED]",
              isShowErrorFrame && "border-[#E40261]",
            )}
          >
            <div className="flex items-center gap-2 relative w-full">
              <div
                style={{ color: iconColor }}
                className="text-xs flex-shrink-0"
              >
                {domainIconUrl ? (
                  <img
                    src={domainIconUrl}
                    alt="Domain Icon"
                    className={cn(
                      "w-8 h-8 rounded-md object-contain bg-white",
                      status === SERVER_STATUS.connected_inactive &&
                        "opacity-50",
                    )}
                    style={
                      status === SERVER_STATUS.connected_inactive
                        ? { filter: "grayscale(100%) brightness(0.8)" }
                        : {}
                    }
                  />
                ) : (
                  <McpIcon
                    style={{
                      color:
                        status === SERVER_STATUS.connected_inactive
                          ? "#C3C4CD"
                          : data.icon,
                    }}
                    className="w-8 h-8 rounded-md bg-white"
                  />
                )}
              </div>
              <p
                className={cn(
                  "capitalize font-semibold mb-0 text-[14px] truncate flex-1 min-w-0",
                  status === SERVER_STATUS.connected_inactive
                    ? "text-[#C3C4CD]"
                    : "text-[var(--color-text-primary)]",
                )}
              >
                {data.name}
              </p>
            </div>
            {status === SERVER_STATUS.pending_auth && (
              <Button
                variant="primary"
                className="px-1 mt-1 font-semibold rounded-[4px] text-[7px] w-fit h-4"
                size="sm"
                onClick={(e) => handleAuthenticate(data.name, e)}
              >
                Get Access
              </Button>
            )}
            {status !== SERVER_STATUS.pending_auth && (
              <p
                className={cn(
                  "text-[12px] font-semibold",
                  status === SERVER_STATUS.connected_inactive
                    ? "text-[#C3C4CD]"
                    : "text-[#6B6293]",
                )}
              >
                {data.tools?.length || 0} Tools
              </p>
            )}
          </Card>
        </div>
      </motion.div>
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-transparent"
        isConnectable={isConnectable}
      />
      <AuthenticationDialog
        userCode={userCode}
        onClose={() => setUserCode(null)}
      />
    </motion.div>
  );

  function handleAuthenticate(
    serverName: string,
    e: React.MouseEvent<HTMLButtonElement>,
  ) {
    e.stopPropagation();

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
            } else {
              toast({
                title: "Authentication Error",
                description:
                  "Failed to open authentication window. Please check your popup blocker settings.",
                variant: "destructive",
              });
            }
          } else {
            toast({
              title: "Authentication Error",
              description: "No authorization URL received from server.",
              variant: "destructive",
            });
          }
          if (userCode) {
            dismiss();
            setUserCode(userCode);
          }
        },
        onError: (error) => {
          toast({
            title: "Authentication Failed",
            description: `Failed to initiate authentication: ${error.message}`,
            variant: "destructive",
          });
        },
      },
    );
  }
};

export default memo(McpServerNodeRenderer);
