import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Handle, NodeProps, Position } from "@xyflow/react";
import { Hexagon } from "lucide-react";
import { memo } from "react";
import { StatusIcon } from "../StatusIcon";
import { McpxNode } from "../types";

const McpxNodeRenderer = ({ data }: NodeProps<McpxNode>) => {
  const isRunning = data.status === "running";
  const getNodeColors = () => {
    if (data.status === "running") {
      return "";
    } else {
      return "border-gray-400 bg-gray-50";
    }
  };

  const getVersionNumber = (version: string) => {
    if (!version) return "Unknown";
    return version.split("-")[0];
  };

  return (
    <div className="shadow-lg rounded-xl">
      <div className="flex flex-col items-center relative" id="mcpx-node">
        <Card
          className={`
           ${isRunning ? "shadow-lg shadow-[#B4108B]/40" : "border-[#DDDCE4]"}
            cursor-pointer  w-28 flex flex-col gap-1 transition-all border-[#B4108B] p-2 duration-300 hover:shadow-sm`}
        >
          <div className="flex-grow flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-0.5">
              <div className="rounded-sm p-1 bg-gradient-to-b from-[var(--color-fg-interactive)] to-[var(--color-fg-primary-accent)]">
                <Hexagon className="text-white w-3.5 h-3.5" strokeWidth={1} />
              </div>
              <h3 className="font-bold text-[var(--color-text-primary)] text-[10px] mb-0">
                MCPX
              </h3>
            </div>
            <div>
              <p className="text-[8px] font-semibold text-[var(--color-text-secondary)]">
                Gateway
              </p>
              <p className="text-[8px] text-[var(--color-text-secondary)]">
                Version {getVersionNumber(data.version || "Unknown")}
              </p>
            </div>
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
