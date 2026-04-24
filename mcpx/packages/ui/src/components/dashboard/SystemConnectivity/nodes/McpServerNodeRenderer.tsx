import { cn } from "@/lib/utils";
import { Handle, NodeProps, Position } from "@xyflow/react";
import { useState } from "react";
import { motion } from "framer-motion";

import { useInitiateServerAuth } from "@/data/server-auth";
import { useToast } from "@/components/ui/use-toast";
import { SERVER_STATUS } from "@/types/mcp-server";
import { useDomainIcon } from "@/hooks/useDomainIcon";
import { useModalsStore } from "@/store";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  NodeBadge,
  NodeCard,
  NodeCardIcon,
  NodeIndicatorBadge,
} from "@/components/ui/node-card";

import { AuthenticationDialog } from "../../AuthenticationDialog";
import { McpServerNode } from "../types";
import McpIcon from "./Mcpx_Icon.svg?react";

type ServerVariant = "default" | "warning" | "info" | "error" | "disabled";

function getServerVariant(
  status: string,
  isShowErrorFrame: boolean,
  isInactive: boolean,
): ServerVariant {
  if (isShowErrorFrame) return "error";
  if (isInactive) return "disabled";
  if (status === SERVER_STATUS.pending_input) return "warning";
  if (status === SERVER_STATUS.pending_auth) return "info";
  return "default";
}

const McpServerNodeRenderer = ({
  data,
  isConnectable,
}: NodeProps<McpServerNode>) => {
  const { mutate: initiateServerAuth } = useInitiateServerAuth();
  const { toast, dismiss } = useToast();
  const [userCode, setUserCode] = useState<string | null>(null);
  const { openServerDetailsModal, selectedServer } = useModalsStore((s) => ({
    openServerDetailsModal: s.openServerDetailsModal,
    selectedServer: s.selectedServer,
  }));

  const selected = selectedServer?.name === data.name;

  const { status } = data;
  const domainIconUrl = useDomainIcon(data.name);

  const isShowErrorFrame =
    data.tools?.length == 0 && status === SERVER_STATUS.connection_failed;
  const isPendingInput = status === SERVER_STATUS.pending_input;
  const isPendingAuth = status === SERVER_STATUS.pending_auth;
  const isInactive = status === SERVER_STATUS.connected_inactive;

  const isConnected =
    !isPendingAuth &&
    !isPendingInput &&
    !isShowErrorFrame &&
    !isInactive &&
    status !== SERVER_STATUS.connecting;

  const variant = getServerVariant(status, isShowErrorFrame, isInactive);
  const state = selected ? ("active" as const) : ("default" as const);

  return (
    <motion.div>
      <Handle
        type="target"
        position={Position.Left}
        className="bg-transparent!"
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
          <NodeCard
            variant={variant}
            state={state}
            className="w-[190px] cursor-pointer gap-2"
          >
            {isShowErrorFrame && <NodeIndicatorBadge variant="error" />}
            {isPendingInput && <NodeIndicatorBadge variant="warning" />}
            {isPendingAuth && <NodeIndicatorBadge variant="info" />}

            <div className="flex items-center gap-3 min-w-0 w-full">
              <NodeCardIcon>
                {domainIconUrl ? (
                  <img
                    src={domainIconUrl}
                    alt="Domain Icon"
                    className={cn(
                      "size-[30px] object-contain",
                      isInactive && "grayscale",
                    )}
                  />
                ) : (
                  <McpIcon
                    style={{
                      color: isInactive ? "var(--colors-gray-400)" : data.icon,
                    }}
                    className="size-[30px]"
                  />
                )}
              </NodeCardIcon>
              <div className="flex flex-col gap-1 min-w-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className={cn(
                        "text-sm font-semibold capitalize truncate",
                        isInactive
                          ? "text-[var(--colors-gray-500)]"
                          : "text-[var(--colors-gray-950)]",
                      )}
                    >
                      {data.name}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{data.name}</TooltipContent>
                </Tooltip>

                {status === SERVER_STATUS.connecting && (
                  <NodeBadge>Connecting...</NodeBadge>
                )}
                {isPendingAuth && (
                  <NodeBadge variant="info">Pending auth</NodeBadge>
                )}
                {isPendingInput && (
                  <NodeBadge variant="warning">Pending user input</NodeBadge>
                )}
                {isShowErrorFrame && (
                  <NodeBadge variant="error">Connection error</NodeBadge>
                )}
                {isInactive && (
                  <NodeBadge variant="disabled">Disabled</NodeBadge>
                )}
                {isConnected && (
                  <span className="text-xs font-semibold text-[var(--colors-gray-500)]">
                    {data.tools?.length || 0} Tools
                  </span>
                )}
              </div>
            </div>

            {isPendingAuth && (
              <Button
                variant="node-card"
                className="w-full"
                onClick={(e) => handleAuthenticate(data.name, e)}
              >
                Get access
              </Button>
            )}
            {isPendingInput && (
              <Button
                variant="node-card"
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  openServerDetailsModal(data, {
                    fromInsertValueButton: true,
                  });
                }}
              >
                Insert input
              </Button>
            )}
          </NodeCard>
        </div>
      </motion.div>
      <Handle
        type="source"
        position={Position.Right}
        className="bg-transparent!"
        isConnectable={isConnectable}
      />
      <AuthenticationDialog
        userCode={userCode}
        serverStatus={status}
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

export default McpServerNodeRenderer;
