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
    <div className="rounded-xl">
      <div className="flex flex-col items-center relative" id="mcpx-node">
        <Card
          className={`rounded-xl
           ${isRunning ? "" : "border-[#E30CA1]"}
            cursor-pointer h-[90px] w-[140px] justify-between  flex flex-col gap-1 transition-all border-[#B4108B] p-4 duration-300 bg-white border-[#E30CA1]`}
        >
          <div className="flex-grow justify-between  flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-0.5">
              <div className="w-8 h-8 bg-gradient-to-br from-[var(--color-fg-interactive)] to-[var(--color-fg-primary-accent)] rounded-[8px] flex items-center justify-center">
                <Hexagon className="w-6 h-6 text-[var(--color-text-primary-inverted)]" />
              </div>
              <p className="text-[#231A4D] text-[16px] font-bold mb-0">
                MCPX
              </p>
            </div>
            <div>
              <p className="text-[12px] font-semibold text-[#6B6293]">
                Gateway V{getVersionNumber(data.version || "Unknown")}
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
