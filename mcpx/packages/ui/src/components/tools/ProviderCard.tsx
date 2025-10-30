import { Lock, ChevronRight } from "lucide-react";
import { ToolCard } from "@/components/tools/ToolCard";
import { ToolsItem } from "@/types";
import { useMemo, useState } from "react";
import { TargetServerNew } from "@mcpx/shared-model";
// @ts-ignore - SVG import issue
import McpIcon from "../dashboard/SystemConnectivity/nodes/Mcpx_Icon.svg?react";
import { useDomainIcon } from "@/hooks/useDomainIcon";
import { Button } from "@/components/ui/button";

interface ProviderCardProps {
  provider: TargetServerNew;
  isExpanded: boolean;
  isEditMode: boolean;
  isAddCustomToolMode: boolean;
  selectedTools: Set<string>;
  onProviderClick: (providerName: string) => void;
  onToolSelectionChange: (
    tool: Tool,
    providerName: string,
    isSelected: boolean,
  ) => void;
  onSelectAllTools?: (providerName: string) => void;
  handleEditClick: (tool: ToolsItem) => void;
  handleDuplicateClick: (tool: ToolsItem) => void;
  handleDeleteTool: (tool: ToolsItem) => void;
  handleCustomizeTool: (tool: ToolsItem) => void;
  onToolClick?: (tool: ToolsItem) => void;
  selectedToolForDetails?: any;
  recentlyCustomizedTools?: Set<string>;
  currentlyCustomizingTools?: Set<string>;
}

type Tool = {
  isCustom: boolean;
  name?: string;
  description?: string;
  inputSchema?: any;
  serviceName?: string;
  originalToolId?: string;
  originalToolName?: string;
  overrideParams?: Record<string, { value: string }>;
};

export function ProviderCard({
  provider,
  isExpanded,
  isEditMode,
  selectedTools,
  isAddCustomToolMode,
  onProviderClick,
  onToolSelectionChange,
  onSelectAllTools,
  handleEditClick,
  handleDuplicateClick,
  handleDeleteTool,
  handleCustomizeTool,
  onToolClick,
  selectedToolForDetails,
  recentlyCustomizedTools,
  currentlyCustomizingTools,
}: ProviderCardProps) {

  const domainIconUrl = useDomainIcon(provider.name);


  const tools: Tool[] = useMemo(
    () =>
      provider.originalTools
        .filter(tool => tool?.name) // Filter out tools without names
        .map(({ name, isCustom, ...rest }) => {
          const tool = provider.tools.find((t) => t.name === name);
          return {
            ...(tool ?? {}),
            ...rest,
            name: name, // Ensure name is always present
            isCustom: Boolean(isCustom),
            serviceName: provider.name,
          };
        }),
    [provider.originalTools, provider.tools],
  );

  const getStatusBadge = () => {
    if (provider.state?.type === "connected") {
      return (
        <span className="bg-green-100 text-green-800 text-xs px-3 py-1 rounded-full font-medium border border-green-200">
          CONNECTED
        </span>
      );
    } else if (provider.state?.type === "pending-auth") {
      return (
        <span className="bg-yellow-100 text-yellow-800 text-xs px-3 py-1 rounded-full font-medium border border-yellow-200">
          PENDING AUTH
        </span>
      );
    } else if (provider.state?.type === "connection-failed") {
      return (
        <span className="bg-red-100 text-red-800 text-xs px-3 py-1 rounded-full font-medium border border-red-200">
          CONNECTION FAILED
        </span>
      );
    } else {
      return (
        <span className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full font-medium border border-gray-200 flex items-center gap-1">
          <Lock className="w-3 h-3" />
          Unauthorized
        </span>
      );
    }
  };

  return (
    <div 
      className="bg-white rounded-lg border border-gray-200 hover:shadow-sm transition-shadow"
      data-provider-name={provider.name}
    >
      <div
        className="p-4 cursor-pointer"
        onClick={() => onProviderClick(provider.name)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {domainIconUrl ? (
              <img
                src={domainIconUrl}
                alt={`${provider.name} favicon`}
                className="w-8 h-8"
              />
            ) : (
              <McpIcon style={{ color: provider?.icon }} className="w-8 h-8" />
            )}

            <div>
              <h3 className="font-semibold capitalize text-gray-900 text-lg">
                {provider.name}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Status Badge */}
            {getStatusBadge()}

            {/* Select All Button - only show when creating/editing tool group and provider is connected */}
            {isEditMode && !isAddCustomToolMode && provider.state?.type === "connected" && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 px-2 text-[#4F33CC] hover:text-[#4F33CC] hover:bg-[#4F33CC]/10"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectAllTools?.(provider.name);
                }}
              >
                Select All
              </Button>
            )}

            {/* Usage Count */}
            <span className="text-gray-600 text-sm">
              {provider.originalTools.length} tools
            </span>

            {/* Dropdown Arrow */}
            <ChevronRight
              className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}
            />
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <div className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {tools.length > 0 ? (
                tools
                  .filter((tool: any) => tool?.name) // Filter out tools without names
                  .map((tool: any) => {
                    if (!tool.name) return null; // Safety check
                    const toolKey = `${provider.name}:${tool.name}`;
                    const isSelected = selectedTools.has(toolKey);
                    const selectionLocked = isAddCustomToolMode && selectedTools.size > 0 && !isSelected;
                    return (
                      <div key={toolKey} className="w-full">
                      <ToolCard
                        tool={tool}
                        isEditMode={isEditMode}
                        isAddCustomToolMode={isAddCustomToolMode}
                        isSelected={isSelected}
                        selectionLocked={selectionLocked}
                        onToggleSelection={() => {
                          const isCurrentlySelected =
                            selectedTools.has(toolKey);
                          onToolSelectionChange(
                            tool,
                            provider.name,
                            !isCurrentlySelected,
                          );
                        }}
                        onToolClick={
                          onToolClick ? () => onToolClick(tool) : undefined
                        }
                        onCustomizeTool={handleCustomizeTool}
                        onDeleteTool={handleDeleteTool}
                        isDrawerOpen={
                          selectedToolForDetails &&
                          selectedToolForDetails.name === tool.name &&
                          selectedToolForDetails.serviceName === provider.name
                        }
                        triggerLoading={recentlyCustomizedTools?.has(`${provider.name}:${tool.name}`) || false}
                        isCustomizing={currentlyCustomizingTools?.has(`${provider.name}:${tool.name}`) || false}
                      />

                   
                      
                    </div>
                  );
                })
                  .filter(Boolean) // Remove null entries
              ) : (
                <div className="col-span-full text-center py-8 text-gray-500 text-sm">
                  No tools available
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
