import { Card } from "@/components/ui/card";
import { isActive } from "@/utils";
import { Handle, NodeProps, Position } from "@xyflow/react";
import { Brain } from "lucide-react";
import { memo } from "react";
import { StatusIcon } from "../StatusIcon";
import { AgentNode } from "../types";

const AgentNodeRenderer = ({ data }: NodeProps<AgentNode>) => {
  const isAgentActive = isActive(data.usage.lastCalledAt);
  return (
    <div className="shadow-sm rounded-xl">
      <div
        className="flex flex-col items-center gap-0.5 relative"
        id={`agent-${data.id}`}
      >
        <Card
          className={`p-1 w-20 transition-all duration-300 hover:shadow-sm border cursor-pointer ${
            isAgentActive
              ? "border-[var(--color-fg-success)] bg-[var(--color-bg-success)]"
              : "border-[var(--color-border-primary)] bg-[var(--color-bg-info)]"
          }`}
        >
          <div className="flex items-center justify-between mb-0.5">
            <Brain
              className={`w-2.5 h-2.5 ${data.status === "connected" ? "text-[var(--color-fg-interactive)]" : "text-[var(--color-text-disabled)]"}`}
            />
            <StatusIcon
              status={
                data.status === "connected"
                  ? isAgentActive
                    ? "connected_running"
                    : "connected_stopped"
                  : "disconnected"
              }
            />
          </div>
          <h3 className="font-medium text-[var(--color-text-primary)] text-[9px] mb-0">
            AI Agent
          </h3>
          <p className="text-[7px] text-[var(--color-text-secondary)] font-mono truncate w-full">
            {data.identifier}
          </p>
          <Handle
            type="source"
            position={Position.Right}
            className="max-w-0 max-h-0 min-w-0 min-h-0 rounded-none border-none"
          />
        </Card>
      </div>
    </div>
  );
};

export default memo(AgentNodeRenderer);
