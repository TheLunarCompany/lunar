import { Square } from "lucide-react";
import { useState } from "react";

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
  isSelected: boolean;
  onToggleSelection: () => void;
  onToolClick?: () => void;
}

const styles = {
  toolCard:
    "bg-white rounded-lg p-3 border-2 border-gray-200 hover:border-[#4F33CC] hover:shadow-md transition-all duration-200 min-h-[100px] flex flex-col",
  toolCardSelected: " border-[#4F33CC] hover:border-[#4F33CC]",
  toolCardHeader: "flex justify-between items-start mb-2 relative",
  checkboxButton: "text-gray-500 transition-colors absolute top-0 right-0 z-10",
  checkboxIcon: "w-4 h-4",
  purpleCheckbox:
    "bg-[#4F33CC] text-white w-4 h-4 rounded flex items-center justify-center",
  toolCardContent: "flex-1 flex flex-col justify-between",
  toolTitle: "font-medium text-gray-900 text-sm mb-1 truncate",
  toolDescription:
    "text-gray-600 text-xs text-overflow-ellipsis leading-relaxed",
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
  isSelected,
  onToggleSelection,
  onToolClick,
}) => {
  return (
    <>
      <style>{customStyles}</style>
      <div
        className={`${styles.toolCard} ${isEditMode && isSelected ? styles.toolCardSelected : ""}`}
        onClick={isEditMode ? onToggleSelection : onToolClick}
        style={{ cursor: isEditMode || onToolClick ? "pointer" : "default" }}
      >
        <div className={styles.toolCardHeader}>
          {isEditMode && (
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
            <h3 className={styles.toolTitle} title={tool.name}>
              {tool.name}
            </h3>
            <p
              className={styles.toolDescription}
              title={tool.description || "No description available"}
            >
              {tool.description || "No description available"}
            </p>
          </div>
        </div>
      </div>
    </>
  );
};
