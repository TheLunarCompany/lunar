import { DEFAULT_SERVER_ICON } from "@/components/dashboard/constants";
import { Card } from "@/components/ui/card";
import { Handle, NodeProps, Position } from "@xyflow/react";
import { memo } from "react";
import { StatusIcon } from "../StatusIcon";
import { McpServerNode } from "../types";

const McpServerNodeRenderer = ({ data }: NodeProps<McpServerNode>) => {
  const isRunning = data.status === "connected_running";
  const isConnected =
    data.status === "connected_running" || data.status === "connected_stopped";
  return (
    <div className={`${data.selected ? "shadow-lg" : "shadow-sm"} rounded-xl`}>
      <div
        className="flex flex-col items-center gap-0.5 relative"
        id={`server-${data.id}`}
      >
        <Card
          className={`p-1 w-24 cursor-pointer transition-all duration-300 hover:shadow-sm border ${
            isRunning
              ? "border-[var(--color-border-success)] bg-[var(--color-bg-success)]"
              : isConnected
                ? "border-[var(--color-border-info)] bg-[var(--color-bg-info)]"
                : "border-[var(--color-border-primary)] bg-[var(--color-bg-container)]"
          } ${data.selected ? (isRunning ? "ring-1 ring-offset-0.5 ring-[var(--color-fg-success)]" : "ring-1 ring-offset-0.5 ring-[var(--color-fg-interactive)]") : ""}`}
        >
          <div className="flex items-center justify-between mb-0.5">
            <div className="text-xs">{data.icon || DEFAULT_SERVER_ICON}</div>
            <StatusIcon status={data.status} />
          </div>
          <h3 className="font-medium text-[var(--color-text-primary)] mb-0 text-[9px] truncate">
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
