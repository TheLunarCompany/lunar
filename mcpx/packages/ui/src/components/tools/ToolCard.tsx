import { Square, Plus, Settings, Trash2 } from "lucide-react";
import CustomBadge from "@/components/CustomBadge";
import { EllipsisActions } from "@/components/ui/ellipsis-action";
import { useCallback, useEffect, useRef, useState } from "react";

interface ToolCardProps {
  tool: {
    name: string;
    description?: string;
    inputSchema?: any;
    isCustom?: boolean;
    originalToolName?: string;
    originalToolId?: string;
    serviceName?: string;
  };
  isEditMode: boolean;
  isAddCustomToolMode: boolean;
  isSelected: boolean;
  selectionLocked?: boolean;
  onToggleSelection: () => void;
  onToolClick?: () => void;
  onCustomizeTool?: (tool: any) => void;
  onClick?: () => void;
  onDeleteTool?: (tool: any) => void;
  isDrawerOpen?: boolean;
  isLoading?: boolean;
  triggerLoading?: boolean;
  isCustomizing?: boolean; // New prop to show loading when customization starts
  isDeleting?: boolean; // New prop to trigger delete animation
  providerName?: string; // Provider name for data attributes
}

const styles = {
  toolCard:
    "bg-white rounded-lg p-3 border-2 border-gray-200 hover:border-[#4F33CC] hover:shadow-md transition-all duration-200 min-h-[120px] flex flex-col",
  toolCardSelected: " border-[#4F33CC] hover:border-[#4F33CC]",
  toolCardHeader: "flex justify-between items-start  relative",
  checkboxButton: "text-gray-500 transition-colors absolute top-0 right-0 z-10",
  checkboxIcon: "w-4 h-4",
  purpleCheckbox:
    "bg-[#4F33CC] text-white w-4 h-4 rounded flex items-center justify-center",
  toolCardContent: "flex-1 flex flex-col justify-between",
  toolTitle: "font-medium text-gray-900 text-sm mb-1 truncate min-h-[20px] ",
  toolDescription:
    "text-gray-600 text-xs text-overflow-ellipsis leading-relaxed max-w-[100%] h-[40px] ",
};

const customStyles = `
  .text-overflow-ellipsis {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    word-break: break-word;
  }
`;

export const ToolCard: React.FC<ToolCardProps> = ({
  tool,
  isEditMode,
  isAddCustomToolMode,
  isSelected,
  selectionLocked = false,
  onToggleSelection,
  onToolClick,
  onCustomizeTool,
  onDeleteTool,
  isDrawerOpen = false,
  isLoading = false,
  triggerLoading = false,
  isCustomizing = false,
  isDeleting = false,
  providerName,
}) => {
  const [internalLoading, setInternalLoading] = useState(false);

  // Simple loading logic: show skeleton for title during customization
  // useEffect(() => {
  //   if (isCustomizing || triggerLoading) {
  //     setInternalLoading(true);
  //   } else {
  //     // Hide loading after a brief delay
  //     const timer = setTimeout(() => {
  //       setInternalLoading(false);
  //     }, 100);
  //     return () => clearTimeout(timer);
  //   }
  // }, [isCustomizing, triggerLoading]);


  
  const isSelectionMode = isEditMode || isAddCustomToolMode;
  const isOriginalTool = !tool.isCustom;
  const isSelectable =
    isSelectionMode &&
    (isEditMode || (isAddCustomToolMode && isOriginalTool)) &&
    (!selectionLocked || isSelected);

  const handleClick = useCallback(() => {
    if (isSelectable) {
      onToggleSelection();
    } else if (!selectionLocked && onToolClick) {
      onToolClick();
    }
  }, [isSelectable, selectionLocked, onToggleSelection, onToolClick]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!isSelectable) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onToggleSelection();
      }
    },
    [isSelectable, onToggleSelection],
  );

  return (
    <>
      <style>{customStyles}</style>
      <div
        className={`${styles.toolCard} ${isSelectionMode && isSelected ? styles.toolCardSelected : ""} ${
           isDrawerOpen ? "!border-[#B4108B] !shadow-lg !shadow-[#B4108B]/40" : ""
         } `}
        data-tool-name={tool.name}
        data-provider={providerName}
        title={tool.name}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role={isSelectionMode ? "checkbox" : undefined}
        aria-checked={isSelectionMode ? isSelected : undefined}
        tabIndex={isSelectable ? 0 : -1}
        style={{
          cursor: isSelectable ? "pointer" : selectionLocked ? "not-allowed" : onToolClick ? "pointer" : "default",

          opacity: selectionLocked && !isSelected ? 0.6 : 1,
        }}
      >

        
        <div className={styles.toolCardHeader}>
          {isSelectionMode && !internalLoading && (
            <div className={styles.checkboxButton}>
              {isSelected ? (
                <div className={styles.purpleCheckbox}>
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              ) : (
                <Square className={styles.checkboxIcon} />
              )}
            </div>
          )}

          <div className={styles.toolCardContent}>
            {/* Normal content state - always show content, just skeleton the title when loading */}
            <div className="flex justify-between items-start h-full">
                <div className=" flex flex-col min-h-0">
                  <div className=" flex flex-col min-h-0">
                    <div className="w-[200px]">
                      {internalLoading ? (
                        // Skeleton only for title
                        <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                      ) : (
                        <h3 className={styles.toolTitle} title={tool.name}>
                          {tool.name ||   <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div> }
                        </h3>
                      )}
                    </div>

                  <div className=" min-h-0 overflow-hidden">
                  <p
                    className={`${styles.toolDescription} h-full`}
                    title={tool.description || "No description available"}
                  >
                    {tool.description || "No description available"}
                  </p>
                  </div>
                  </div>

                  {tool.isCustom && (
                    <div className="mt-2 flex flex-shrink-0">
                      <CustomBadge
                        color="blue"
                        size="xs"
                        rounded="lg"
                        label={<span >CUSTOM</span>}
                        icon={
                          <svg
                            className="w-4 h-4"
                            style={{ color: "#4F33CC" }}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                            <polyline points="3.27,6.96 12,12.01 20.73,6.96" />
                            <line x1="12" y1="22.08" x2="12" y2="12" />
                          </svg>
                        }
                      />
                    </div>
                  )}
                </div>

                {/* EllipsisActions for tool customization/edit - hidden in edit or add modes */}
                {!isEditMode && !isAddCustomToolMode && !internalLoading && (
                  <div className="ml-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <EllipsisActions
                      items={[
                      ...(onCustomizeTool ? [{
                        label: tool.isCustom ? "Edit" : "Customize",
                        icon: <Settings className="w-4 h-4" />,
                        callback: () => onCustomizeTool(tool)
                      }] : []),
                        ...(tool.isCustom && onDeleteTool ? [{
                          label: "Delete",
                          icon: <Trash2 className="w-4 h-4" />,
                          callback: () => onDeleteTool(tool)
                        }] : []),
                      ]}
                    />
                  </div>
                )}
              </div>
          </div>
        </div>
      </div>
    </>
  );
};
