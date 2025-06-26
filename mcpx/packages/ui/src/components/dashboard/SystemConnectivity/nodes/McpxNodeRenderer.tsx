import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Handle, NodeProps, Position } from "@xyflow/react";
import { Hexagon } from "lucide-react";
import { memo } from "react";
import { StatusIcon } from "../StatusIcon";
import { McpxNode } from "../types";

const McpxNodeRenderer = ({ data }: NodeProps<McpxNode>) => {
  return (
    <div className="shadow-lg rounded-xl">
      <div className="flex flex-col items-center relative" id="mcpx-node">
        <Card
          className={`w-24 transition-all duration-300 border flex flex-col cursor-pointer ${
            data.status === "running"
              ? "border-[var(--color-fg-success)] bg-[var(--color-bg-success)]"
              : "border-[var(--color-border-info)] bg-[var(--color-bg-container)]"
          }`}
        >
          <div className="p-1.5 flex-grow">
            <div className="flex items-center justify-between mb-0.5">
              <div
                className={`w-5 h-5 rounded-md flex items-center justify-center ${
                  data.status === "running"
                    ? "bg-[var(--color-bg-success)]"
                    : "bg-[var(--color-text-disabled)]"
                }`}
              >
                <Hexagon
                  className={`w-3 h-3  ${
                    data.status === "running"
                      ? "text-[var(--color-fg-success)]"
                      : "text-[var(--color-text-primary-inverted)]"
                  }`}
                />
              </div>
              <StatusIcon status={data.status} />
            </div>
            <h3 className="font-bold text-[var(--color-text-primary)] text-[10px] mb-0">
              MCPX
            </h3>
            <p className="text-[8px] text-[var(--color-text-secondary)]">
              Aggregator
            </p>
            <Badge
              variant="outline"
              className={`mt-0.5 text-[7px] px-1 py-0 ${
                data.status === "running"
                  ? "border-[var(--color-border-success)] text-[var(--color-fg-success)] bg-[var(--color-bg-success)]"
                  : "border-[var(--color-border-primary)] text-[var(--color-text-secondary)] bg-[var(--color-bg-container)]"
              }`}
            >
              {data.status === "running" ? "Active" : "Idle"}
            </Badge>
          </div>
        </Card>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="max-w-0 max-h-0 min-w-0 min-h-0 rounded-none border-none"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="max-w-0 max-h-0 min-w-0 min-h-0 rounded-none border-none"
      />
    </div>
  );
};

export default memo(McpxNodeRenderer);
