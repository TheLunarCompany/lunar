import { Handle, NodeProps, Position } from "@xyflow/react";
import { Hexagon } from "lucide-react";
import { memo } from "react";
import { McpxNode } from "../types";
import { NodeCard, NodeBadge, NodeCardIcon } from "@/components/ui/node-card";
import { useModalsStore } from "@/store";

const McpxNodeRenderer = ({
  data,
  selected: isRouteSelected = false,
}: NodeProps<McpxNode>) => {
  const isMcpxDetailsModalOpen = useModalsStore(
    (s) => s.isMcpxDetailsModalOpen,
  );
  const selected = isRouteSelected || isMcpxDetailsModalOpen;
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
        className="w-[220px] cursor-pointer border-mcpx-selected shadow-none hover:border-mcpx-selected"
      >
        <div className="flex items-center gap-3">
          <NodeCardIcon className="border-mcpx-surface-tertiary bg-mcpx-selected-weak">
            <Hexagon className="size-6 text-mcpx-selected" />
          </NodeCardIcon>
          <div className="flex flex-col gap-1 overflow-hidden">
            <span className="text-sm leading-[1.5] font-bold text-mcpx-text">
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
