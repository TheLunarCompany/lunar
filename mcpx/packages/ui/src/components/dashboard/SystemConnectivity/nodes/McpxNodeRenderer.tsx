import { Handle, NodeProps, Position } from "@xyflow/react";
import { Hexagon } from "lucide-react";
import { memo } from "react";
import { McpxNode } from "../types";
import { NodeCard, NodeBadge, NodeCardIcon } from "@/components/ui/node-card";
import { useModalsStore } from "@/store";

const McpxNodeRenderer = ({ data }: NodeProps<McpxNode>) => {
  const selected = useModalsStore((s) => s.isMcpxDetailsModalOpen);
  const getVersionNumber = (version: string) => {
    if (!version) return "Unknown";
    return version.split("-")[0];
  };

  return (
    <div>
      <Handle
        type="target"
        position={Position.Left}
        className="max-w-0 max-h-0 min-w-0 min-h-0 rounded-none border-none"
      />
      <NodeCard
        variant="default"
        state={selected ? "active" : "default"}
        className={`w-[220px] cursor-pointer ${
          selected
            ? "border-[#B4108B] bg-white"
            : "[background:linear-gradient(white,white)_padding-box,linear-gradient(to_bottom_right,var(--colors-primary-500),var(--colors-secondary-200))_border-box] border border-transparent"
        }`}
      >
        <div className="flex items-center gap-3">
          <NodeCardIcon className="border-none bg-gradient-to-br from-[#CDCBFF] to-[#FFE5F5]">
            <Hexagon className="size-6 text-[var(--colors-primary-500)]" />
          </NodeCardIcon>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-bold text-[var(--colors-gray-950)]">
              MCPX
            </span>
            <NodeBadge>
              V{getVersionNumber(data.version || "Unknown")}
            </NodeBadge>
          </div>
        </div>
      </NodeCard>
      <Handle
        type="source"
        position={Position.Right}
        className="max-w-0 max-h-0 min-w-0 min-h-0 rounded-none border-none"
      />
    </div>
  );
};

export default memo(McpxNodeRenderer);
