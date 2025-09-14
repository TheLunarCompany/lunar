import { DEFAULT_SERVER_ICON } from "@/components/dashboard/constants";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Handle, NodeProps, Position } from "@xyflow/react";
import { memo } from "react";
import { StatusIcon } from "../StatusIcon";
import { McpServerNode } from "../types";

const McpServerNodeRenderer = ({ data }: NodeProps<McpServerNode>) => {
  const isRunning = data.status === "connected_running";
  const isConnected = data.status === "connected_stopped";
  const isPendingAuth = data.status === "pending_auth";
  const isFailed = data.status === "connection_failed";

  const getNodeColors = () => {
    if (isRunning) {
      return "border-green-500 bg-green-50";
    } else if (isConnected) {
      return "border-gray-400 bg-gray-50";
    } else if (isPendingAuth) {
      return "border-yellow-500 bg-yellow-50";
    } else if (isFailed) {
      return "border-red-500 bg-red-50";
    } else {
      return "border-gray-300 bg-white";
    }
  };

  return (
    <div className="shadow-sm rounded-xl">
      <div
        className="flex flex-col items-center gap-0.5 relative"
        id={`server-${data.id}`}
      >
        <Card
          className={`p-1 w-24 cursor-pointer transition-all duration-300 hover:shadow-sm border-2 ${getNodeColors()}`}
        >
          <div className="flex items-center justify-between mb-0.5">
            <div className="text-xs">{data.icon || DEFAULT_SERVER_ICON}</div>
            <StatusIcon status={data.status} />
          </div>
          <h3
            className={cn(
              "font-medium text-[var(--color-text-primary)] mb-0 text-[9px] truncate",
              {
                "text-[var(--color-fg-warning)]":
                  data.status === "pending_auth",
                "text-[var(--color-fg-danger)]":
                  data.status === "connection_failed",
              },
            )}
          >
            {data.name}
          </h3>
          <p className="text-[7px] text-[var(--color-text-secondary)] mb-0.5">
            {data.tools?.length || 0} Tools
          </p>
        </Card>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="max-w-0 max-h-0 min-w-0 min-h-0 rounded-none border-none"
      />
    </div>
  );
};

export default memo(McpServerNodeRenderer);
