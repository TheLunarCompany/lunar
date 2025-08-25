import { ChevronDown, Square } from "lucide-react";
import { useState } from "react";

interface ToolCardProps {
  tool: {
    name: string;
    description?: string;
    inputSchema?: any;
    isCustom?: boolean;
    originalToolName?: string;
    originalToolId?: string;
  };
  isEditMode: boolean;
  isSelected: boolean;
  onToggleSelection: () => void;
}

const styles = {
  toolCard: "bg-gray-100 rounded-lg p-4 border border-gray-200 hover:border-gray-300 transition-colors min-h-[120px] flex flex-col",
  toolCardHeader: "flex justify-between items-start mb-3 relative",
  checkboxButton: "text-gray-600 hover:text-gray-800 transition-colors absolute top-0 right-1 z-10",
  checkboxIcon: "w-5 h-5",
  purpleCheckbox: "bg-purple-600 text-white w-5 h-5 rounded flex items-center justify-center",
  toolCardContent: "flex-1 flex flex-col justify-between",
  toolTitle: "font-semibold text-gray-800 text-sm mb-2 truncate",
  toolDescription: "text-gray-600 text-xs text-overflow-ellipsis",
  viewMoreButton: "text-gray-500 hover:text-gray-700 text-xs flex items-center gap-1 transition-colors",
  viewMoreIcon: "w-3 h-3",
  toolCardExpanded: "mt-3 pt-3 border-t border-gray-200",
  toolCardExpandedText: "text-gray-600 text-xs",
  toolDetails: "space-y-4",
  toolDetailsTitle: "text-sm font-semibold text-gray-800 mb-3",
  toolDetailSection: "space-y-2",
  toolDetailSectionTitle: "text-xs font-medium text-gray-700 uppercase tracking-wide",
  toolDetailText: "text-xs text-gray-600",
  customToolInfo: "space-y-2",
  toolParameters: "space-y-2",
  toolParameter: "flex flex-col space-y-2 p-2 bg-gray-50 rounded border",
  parameterHeader: "flex items-center justify-between",
  parameterName: "text-xs font-medium text-gray-800",
  parameterType: "text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded inline-block w-fit",
  parameterDescription: "text-xs text-gray-600 mt-1",
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

export const ToolCard: React.FC<ToolCardProps> = ({ tool, isEditMode, isSelected, onToggleSelection }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      <style>{customStyles}</style>
      <div className={styles.toolCard}>
        <div className={styles.toolCardHeader}>
          {isEditMode && (
            <button
              onClick={onToggleSelection}
              className={styles.checkboxButton}
              aria-label={isSelected ? `Deselect ${tool.name}` : `Select ${tool.name}`}
              type="button"
            >
              {isSelected ? (
                <div className={styles.purpleCheckbox}>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              ) : (
                <Square className={styles.checkboxIcon} />
              )}
            </button>
          )}
          <div className={styles.toolCardContent}>
            <h3 className={styles.toolTitle} title={tool.name}>
              {tool.name}
            </h3>
            <p className={styles.toolDescription} title={tool.description || "No description available"}>
              {tool.description || "No description available"}
            </p>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={styles.viewMoreButton}
            >
              View More
              {isExpanded ? (
                <ChevronDown className={styles.viewMoreIcon} />
              ) : (
                <ChevronDown className={styles.viewMoreIcon} />
              )}
            </button>
          </div>
        </div>
        
        {isExpanded && (
          <div className={styles.toolCardExpanded}>
            <div className={styles.toolDetails}>
              <h4 className={styles.toolDetailsTitle}>Tool Details</h4>
              
              {tool.isCustom && (
                <div className={styles.toolDetailSection}>
                  <h5 className={styles.toolDetailSectionTitle}>Custom Tool</h5>
                  <div className={styles.customToolInfo}>
                    <p className={styles.toolDetailText}>
                      This is a custom tool that you've created.
                    </p>
                    {tool.originalToolName && (
                      <p className={styles.toolDetailText}>
                        <strong>Based on:</strong> {tool.originalToolName}
                      </p>
                    )}
                    {tool.originalToolId && (
                      <p className={styles.toolDetailText}>
                        <strong>Original Tool ID:</strong> {tool.originalToolId}
                      </p>
                    )}
                  </div>
                </div>
              )}
              
              {tool.description && (
                <div className={styles.toolDetailSection}>
                  <h5 className={styles.toolDetailSectionTitle}>Description</h5>
                  <p className={styles.toolDetailText}>{tool.description}</p>
                </div>
              )}
              
              {tool.inputSchema && (
                <div className={styles.toolDetailSection}>
                  <h5 className={styles.toolDetailSectionTitle}>Parameters</h5>
                  <div className={styles.toolParameters}>
                    {Object.entries(tool.inputSchema.properties || {}).map(([paramName, paramSchema]: [string, any]) => (
                      <div key={paramName} className={styles.toolParameter}>
                        <div className={styles.parameterHeader}>
                          <span className={styles.parameterName}>{paramName}</span>
                          <span className={styles.parameterType}>{paramSchema.type || 'unknown'}</span>
                        </div>
                        {paramSchema.description && (
                          <span className={styles.parameterDescription}>{paramSchema.description}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {(!tool.description && !tool.inputSchema && !tool.isCustom) && (
                <p className={styles.toolCardExpandedText}>
                  No additional details available
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};
