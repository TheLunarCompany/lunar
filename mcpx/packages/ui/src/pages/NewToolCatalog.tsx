import { useSocketStore } from "@/store";
import { TargetServerNew } from "@mcpx/shared-model";
import { ChevronUp, ChevronDown, ChevronRight, Lock, CheckSquare, Square } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";


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

const ToolCard: React.FC<ToolCardProps> = ({ tool, isEditMode, isSelected, onToggleSelection }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={styles.toolCard}>
      <div className={styles.toolCardHeader}>
        {isEditMode && (
          <button
            onClick={onToggleSelection}
            className={styles.checkboxButton}
          >
            {isSelected ? (
              <CheckSquare className={styles.checkboxIcon} />
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
  );
};

interface ProviderAccordionProps {
  provider: TargetServerNew;
  isEditMode: boolean;
  selectedTools: Set<string>;
  onToolSelectionChange: (toolName: string, isSelected: boolean) => void;
}

const ProviderAccordion: React.FC<ProviderAccordionProps> = ({
  provider,
  isEditMode,
  selectedTools,
  onToolSelectionChange,
}) => {
  const getStatusBadge = () => {
    if (provider.state?.type === "connected") {
      return (
        <span className={styles.statusBadgeConnected}>
          Connected
        </span>
      );
    } else if (provider.state?.type === "pending-auth") {
      return (
        <span className={styles.statusBadgePending}>
          Pending Auth
        </span>
      );
    } else if (provider.state?.type === "connection-failed") {
      return (
        <span className={styles.statusBadgeFailed}>
          Connection Failed
        </span>
      );
    } else {
      return (
        <span className={styles.statusBadgeUnauthorized}>
          <Lock className={styles.statusBadgeIcon} />
          Unauthorized
        </span>
      );
    }
  };

  const getProviderIcon = () => {
    if (provider.icon) {
      return provider.icon;
    }
    return "🔧";
  };

  return (
    <AccordionItem value={provider.name} className={styles.accordionItem}>
      <AccordionTrigger className={styles.accordionTrigger}>
        <div className={styles.accordionHeader}>
          <div className={styles.providerInfo}>
            <span className={styles.providerIcon}>{getProviderIcon()}</span>
            <span className={styles.providerName}>{provider.name}</span>
          </div>
          {getStatusBadge()}
        </div>
      </AccordionTrigger>
            <AccordionContent>
        <div className={styles.toolsContainer}>
          {provider.originalTools.length > 0 ? (
            provider.originalTools.map((tool) => (
              <div key={tool.name} className={styles.toolWrapper}>
                <ToolCard
                  tool={tool}
                  isEditMode={isEditMode}
                  isSelected={selectedTools.has(tool.name)}
                  onToggleSelection={() => {
                    const isSelected = selectedTools.has(tool.name);
                    onToolSelectionChange(tool.name, !isSelected);
                  }}
                />
              </div>
            ))
          ) : (
            <div className={styles.noToolsMessage}>
              <p>No tools available</p>
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};

interface NewToolCatalogProps {
  searchFilter?: string;
  showOnlyCustomTools?: boolean;
  toolsList?: Array<any>; 
}

export default function NewToolCatalog({ searchFilter = "", showOnlyCustomTools = false, toolsList = [] }: NewToolCatalogProps) {
  const { systemState } = useSocketStore((s) => ({
    systemState: s.systemState,
  }));

  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());

  const providers = useMemo(() => {
    let filteredProviders = systemState?.targetServers_new || [];
    
    // Filter out providers with connection-failed status
    filteredProviders = filteredProviders.filter(provider => 
      provider.state?.type !== "connection-failed"
    );
    
    const customToolsByProvider = toolsList
      .filter(tool => tool.originalToolId)
      .reduce((acc, tool) => {
        const providerName = tool.serviceName;
        if (!acc[providerName]) {
          acc[providerName] = [];
        }
        acc[providerName].push({
          name: tool.name,
          description: typeof tool.description === 'string' ? tool.description : tool.description?.text || '',
          isCustom: true,
        });
        return acc;
      }, {} as Record<string, any[]>);

    filteredProviders = filteredProviders.map(provider => ({
      ...provider,
      originalTools: [
        ...provider.originalTools,
        ...(customToolsByProvider[provider.name] || [])
      ]
    }));

    // Filter by search term
    if (searchFilter) {
      filteredProviders = filteredProviders.map(provider => ({
        ...provider,
        originalTools: provider.originalTools.filter(tool => 
          tool.name.toLowerCase().includes(searchFilter.toLowerCase())
        )
      })).filter(provider => provider.originalTools.length > 0);
    }
    
    // Filter by custom tools only
    if (showOnlyCustomTools) {
      filteredProviders = filteredProviders.map(provider => ({
        ...provider,
        originalTools: provider.originalTools.filter(tool => tool.isCustom)
      })).filter(provider => provider.originalTools.length > 0);
    }
    
    return filteredProviders;
  }, [systemState?.targetServers_new, searchFilter, showOnlyCustomTools, toolsList]);

  // Calculate total filtered tools for display
  const totalFilteredTools = useMemo(() => {
    return providers.reduce((total, provider) => total + provider.originalTools.length, 0);
  }, [providers]);

  const handleToolSelectionChange = (toolName: string, isSelected: boolean) => {
    const newSelection = new Set(selectedTools);
    if (isSelected) {
      newSelection.add(toolName);
    } else {
      newSelection.delete(toolName);
    }
    setSelectedTools(newSelection);
  };

  const handleEditModeToggle = () => {
    setIsEditMode(!isEditMode);
    if (isEditMode) {
      setSelectedTools(new Set());
    }
  };

  return (
    <>
      <style>{customStyles}</style>
      <div className={styles.container}>
        <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.titleSection}>
            {(searchFilter || showOnlyCustomTools) && (
              <div className={styles.filterInfo}>
                <span className={styles.filterBadge}>
                  Filtered: {totalFilteredTools} tool{totalFilteredTools !== 1 ? 's' : ''} found
                </span>
                {searchFilter && (
                  <span className={styles.searchTerm}>Search: "{searchFilter}"</span>
                )}
                {showOnlyCustomTools && (
                  <span className={styles.customToolsFilter}>Custom tools only</span>
                )}
              </div>
            )}
          </div>
        </div>

        {providers.length === 0 ? (
          !showOnlyCustomTools && !searchFilter ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyStateTitle}>No MCP providers found</p>
              <p className={styles.emptyStateSubtitle}>
                Add MCP servers to see their tools here
              </p>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <p className={styles.emptyStateTitle}>No tools found</p>
              <p className={styles.emptyStateSubtitle}>
                The search term "{searchFilter || "custom tools"}" did not match any tools.
              </p>
            </div>
          )

        ) : (
          <Accordion type="multiple" className={styles.accordion}>
            {providers.map((provider) => (
              <ProviderAccordion
                key={provider.name}
                provider={provider}
                isEditMode={isEditMode}
                selectedTools={selectedTools}
                onToolSelectionChange={handleToolSelectionChange}
              />
            ))}
          </Accordion>
        )}

        {isEditMode && selectedTools.size > 0 && (
          <div className={styles.selectionPanel}>
            <div className={styles.selectionPanelContent}>
              <span className={styles.selectionCount}>
                {selectedTools.size} tool{selectedTools.size !== 1 ? "s" : ""} selected
              </span>
              <button className={styles.applyButton}>
                Apply
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
      </>
  );
}

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

const styles = {
  // Container styles
  container: "min-h-screen w-full bg-[var(--color-bg-app)] relative",
  content: "container mx-auto py-8 px-4",
  
  // Header styles
  header: "flex justify-between items-start gap-12 whitespace-nowrap mb-0",
  title: "text-3xl font-bold tracking-tight",
  titleSection: "flex flex-col gap-2",
  filterInfo: "flex flex-wrap items-center gap-2 text-sm",
  filterBadge: "bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium",
  searchTerm: "bg-gray-100 text-gray-700 px-2 py-1 rounded",
  customToolsFilter: "bg-purple-100 text-purple-800 px-2 py-1 rounded-full font-medium",
  editModeButton: " bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm",
  editModeButtonActive: "bg-blue-600 text-white hover:bg-blue-700",
  editModeButtonInactive: "bg-gray-200 text-gray-800 hover:bg-gray-300",
  
  // Empty state styles
  emptyState: "text-center py-12",
  emptyStateTitle: "text-gray-500 text-lg",
  emptyStateSubtitle: "text-gray-400 text-sm mt-2",
  
  // Accordion styles
  accordion: "space-y-4",
  accordionItem: "border-b border-gray-200",
  accordionTrigger: "hover:no-underline",
  accordionHeader: "flex items-center justify-between gap-3 flex-1",
  providerInfo: "flex items-center gap-3 flex-1",
  providerIcon: "text-xl",
  providerName: "font-semibold text-gray-800",
  
  // Status badge styles
  statusBadgeConnected: "bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium ml-8 mr-2",
  statusBadgePending: "bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-medium ml-12 mr-2",
  statusBadgeFailed: "bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-medium ml-8 mr-2",
  statusBadgeUnauthorized: "bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 ml-8 mr-2",
  statusBadgeIcon: "w-3 h-3",
  
  // Tools container styles
  toolsContainer: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-2",
  toolWrapper: "w-full",
  scrollIndicator: "hidden",
  scrollIcon: "w-5 h-5 text-gray-400",
  noToolsMessage: "col-span-full text-center py-8 text-gray-500 text-sm",
  
  // Tool card styles
  toolCard: "bg-gray-100 rounded-lg p-4 border border-gray-200 hover:border-gray-300 transition-colors min-h-[120px] flex flex-col",
  toolCardHeader: "flex justify-between items-start mb-3 relative",
  checkboxButton: "text-gray-600 hover:text-gray-800 transition-colors absolute top-0 right-0",
  checkboxIcon: "w-5 h-5",
  toolCardContent: "flex-1 flex flex-col justify-between",
  toolTitle: "font-semibold text-gray-800 text-sm mb-2 truncate",
  toolDescription: "text-gray-600 text-xs text-overflow-ellipsis",
  viewMoreButton: "text-gray-500 hover:text-gray-700 text-xs flex items-center gap-1 transition-colors",
  viewMoreIcon: "w-3 h-3",
  toolCardExpanded: "mt-3 pt-3 border-t border-gray-200",
  toolCardExpandedText: "text-gray-600 text-xs",
  
  // Tool details styles
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
  
  // Selection panel styles
  selectionPanel: "fixed bottom-6 right-6 bg-white border border-gray-200 rounded-lg shadow-lg p-4",
  selectionPanelContent: "flex items-center gap-3",
  selectionCount: "text-sm text-gray-600",
  applyButton: "bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors",
};
