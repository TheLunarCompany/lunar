import { DEFAULT_SERVER_ICON } from "@/components/dashboard/constants";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Handle, NodeProps, Position } from "@xyflow/react";
import McpIcon from "./Mcpx_Icon.svg?react";
import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { StatusIcon } from "../StatusIcon";
import { McpServerNode } from "../types";
import { Button } from "@/components/ui/button";
import { useInitiateServerAuth } from "@/data/server-auth";
import { useToast } from "@/components/ui/use-toast";
import { MCP_ICON_COLORS } from "./constants";
import { useDomainIcon } from "@/hooks/useDomainIcon";

const McpServerNodeRenderer = ({
  data,
  isConnectable,
}: NodeProps<McpServerNode>) => {
  const { mutate: initiateServerAuth } = useInitiateServerAuth();
  const { toast } = useToast();

  const isRunning = data.status === "connected_running";
  const isConnected = data.status === "connected_stopped";
  const isPendingAuth = data.status === "pending_auth";
  const isFailed = data.status === "connection_failed";

  const domainIconUrl = useDomainIcon(data.name);

  const isShowErrorFrame = data.tools?.length == 0 && isFailed;

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
          <Card
            className={`  
           ${isRunning ? "border-[#B4108B] shadow-lg shadow-[#B4108B]/40" : "border-[#DDDCE4]"}
         cursor-pointer w-24 flex flex-col gap-1 transition-all p-1.5 duration-300 hover:shadow-sm
         ${isShowErrorFrame && "border-[#E40261]"}
         `}
          >
            <div className="flex items-center gap-2">
              <div
                style={{
                  color:
                    MCP_ICON_COLORS[
                      Math.floor(Math.random() * MCP_ICON_COLORS.length)
                    ],
                }}
                className={`text-xs`}
              >
                {isShowErrorFrame && (
                  <div className="absolute right-1 top-1 flex items-center gap-2">
                    <img
                      alt="Warning"
                      className="w-3 h-3 "
                      src="/icons/warningCircle.png"
                    />
                  </div>
                )}

                {domainIconUrl ? (
                  <img
                    src={domainIconUrl}
                    alt="Domain Icon"
                    className="min-w-6 w-6 min-h-6 h-6 rounded-md object-contain p-1 bg-white"
                  />
                ) : (
                  <McpIcon
                    style={{ color: data.icon }}
                    className="min-w-6 w-6 min-h-6 h-6 rounded-md bg-white p-1"
                  />
                )}
              </div>
              <h3
                className={cn(
                  "capitalize font-semibold text-[var(--color-text-primary)] mb-0 text-[9px] truncate",
                )}
              >
                {data.name}
              </h3>
            </div>
            {isPendingAuth && (
              <Button
                variant="secondary"
                className="px-1 font-semibold rounded-[4px] border-[0.5px] border-component-primary text-[7px] w-fit h-4 text-component-primary "
                size="sm"
                onClick={(e) => handleAuthenticate(data.name, e)}
              >
                Get Access
              </Button>
            )}
            {!isPendingAuth && (
              <p className="text-[8px] font-semibold text-[var(--color-text-secondary)]">
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
            toast({
              title: "Authentication Started",
              description: (
                <div>
                  <p>
                    Please complete the authentication in the opened window.
                  </p>
                </div>
              ),
            });
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
