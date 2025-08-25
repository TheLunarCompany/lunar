import { useSocketStore, useAccessControlsStore } from "@/store";
import { TargetServerNew } from "@mcpx/shared-model";
import { Lock, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { useUpdateAppConfig } from "@/data/app-config";
import { ToolCard } from "@/components/tools/ToolCard";
import YAML from "yaml";




interface ProviderAccordionProps {
  provider: TargetServerNew;
  isEditMode: boolean;
  selectedTools: Set<string>;
  onToolSelectionChange: (toolName: string, providerName: string, isSelected: boolean) => void;
  handleEditClick: (tool: any) => void;
  handleDuplicateClick: (tool: any) => void;
  handleDeleteTool: (tool: any) => void;
  handleCustomizeTool: (tool: any) => void;
}

const ProviderAccordion: React.FC<ProviderAccordionProps> = ({
  provider,
  isEditMode,
  selectedTools,
  onToolSelectionChange,
  handleEditClick,
  handleDuplicateClick,
  handleDeleteTool,
  handleCustomizeTool
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
                  isSelected={selectedTools.has(`${provider.name}:${tool.name}`)}
                  onToggleSelection={() => {
                    const toolKey = `${provider.name}:${tool.name}`;
                    const isSelected = selectedTools.has(toolKey);
                    onToolSelectionChange(tool.name, provider.name, !isSelected);
                  }}
                  onEdit={tool.isCustom ? () => {
                    handleEditClick(tool);
                  } : undefined}
                  onDuplicate={tool.isCustom ? () => {
                    handleDuplicateClick(tool);
                  } : undefined}
                  onDelete={tool.isCustom ? () => {
                    handleDeleteTool(tool);
                  } : undefined}
                  onCustomize={!tool.isCustom ? () => {
                    handleCustomizeTool(tool);
                  } : undefined}
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
  isEditMode?: boolean;
  onEditModeToggle?: () => void;
  onCancelEdit?: () => void;
  handleEditClick: (tool: any) => void;
  handleDuplicateClick: (tool: any) => void;
  handleDeleteTool: (tool: any) => void;
  handleCustomizeTool: (tool: any) => void;
}

export default function NewToolCatalog({ 
  searchFilter = "", 
  showOnlyCustomTools = false, 
  toolsList = [],
  isEditMode = false,
  onEditModeToggle,
  onCancelEdit,
  handleEditClick,
  handleDuplicateClick,
  handleDeleteTool,
  handleCustomizeTool
}: NewToolCatalogProps) {
  const { systemState, appConfig } = useSocketStore((s) => ({
    systemState: s.systemState,
    appConfig: s.appConfig,
  }));

  const { toolGroups, setToolGroups, appConfigUpdates, hasPendingChanges, setAppConfigUpdates } = useAccessControlsStore((s) => ({
    toolGroups: s.toolGroups,
    setToolGroups: s.setToolGroups,
    appConfigUpdates: s.appConfigUpdates,
    hasPendingChanges: s.hasPendingChanges,
    setAppConfigUpdates: s.setAppConfigUpdates,
  }));

  const { mutateAsync: updateAppConfigAsync, isPending } = useUpdateAppConfig();
  const { toast } = useToast();

  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

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
          serviceName: tool.serviceName,
          originalToolId: tool.originalToolId,
          originalToolName: tool.originalToolName,
          isCustom: true,
        });
        return acc;
      }, {} as Record<string, any[]>);

    filteredProviders = filteredProviders.map(provider => ({
      ...provider,
      originalTools: [
        ...provider.originalTools.map(tool => ({
          ...tool,
          serviceName: provider.name
        })),
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

  const handleToolSelectionChange = (toolName: string, providerName: string, isSelected: boolean) => {
    const toolKey = `${providerName}:${toolName}`;
    const newSelection = new Set(selectedTools);
    if (isSelected) {
      newSelection.add(toolKey);
    } else {
      newSelection.delete(toolKey);
    }
    setSelectedTools(newSelection);
  };


  const handleCreateToolGroup = () => {
    setShowCreateModal(true);
  };

  const handleSaveToolGroup = async () => {
    if (!newGroupName.trim()) return;
    
    if (toolGroups.some(group => group.name === newGroupName.trim())) {
      toast({
        title: "Error",
        description: "A tool group with this name already exists. Please choose a different name.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);

    try {
      const toolsByProvider = new Map<string, string[]>();
      
      selectedTools.forEach(toolKey => {
        const [providerName, toolName] = toolKey.split(':');
        if (providerName && toolName) {
          if (!toolsByProvider.has(providerName)) {
            toolsByProvider.set(providerName, []);
          }
          toolsByProvider.get(providerName)!.push(toolName);
        }
      });

      const newToolGroup = {
        id: `tool_group_${toolGroups.length}`,
        name: newGroupName.trim(),
        services: Object.fromEntries(toolsByProvider),
      };

      setToolGroups(prev => [...prev, newToolGroup]);
      await new Promise(resolve => setTimeout(resolve, 0));
      
      try {
        const currentAppConfig = appConfig;
        if (currentAppConfig) {
          const updatedAppConfig = {
            ...currentAppConfig,
            toolGroups: [
              ...currentAppConfig.toolGroups,
              {
                name: newToolGroup.name,
                services: newToolGroup.services,
              }
            ]
          };

          await updateAppConfigAsync({
            yaml: YAML.stringify(updatedAppConfig)
          });

          toast({
            title: "Success",
            description: `Tool group "${newGroupName.trim()}" created successfully!`,
          });
        }
      } catch (error) {
        console.error('Failed to save tool group:', error);
        toast({
          title: "Error",
          description: "Tool group created but failed to save. Please try again.",
          variant: "destructive",
        });
      }
      
      // Reset state
      setNewGroupName("");
      setShowCreateModal(false);
      if (onCancelEdit) {
        onCancelEdit();
      }
      setSelectedTools(new Set());
      
    } catch (error) {
      console.error('Failed to create tool group:', error);
      toast({
        title: "Error",
        description: "Failed to create tool group. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setNewGroupName("");
  };

  return (
    <>
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
                handleEditClick={handleEditClick}
                handleDuplicateClick={handleDuplicateClick}
                handleDeleteTool={handleDeleteTool}
                handleCustomizeTool={handleCustomizeTool}
              />
            ))}
          </Accordion>
        )}

        {isEditMode && selectedTools.size > 0 && (
          <div className={styles.selectionPanel}>
            <div className={styles.selectionPanelContent}>
              <div className={styles.selectionInfo}>
                <div className={styles.toolCounter}>
                  <span className={styles.toolCounterIcon}>{selectedTools.size}</span>
                  <span className={styles.toolCounterText}>
                    Tool{selectedTools.size !== 1 ? 's' : ''} selected
                  </span>
                </div>
              </div>
              <div className={styles.selectionActions}>
                <Button
                  onClick={handleCreateToolGroup}
                  className={styles.createButton}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create
                </Button>
                <Button
                  onClick={() => setSelectedTools(new Set())}
                  variant="outline"
                  className={styles.removeButton}
                  title="Clear all selected tools"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remove
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

      {/* Create Tool Group Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className={styles.modalContent}>
          <DialogHeader>
            <DialogTitle>Create Tool Group</DialogTitle>
          </DialogHeader>
          <div className={styles.modalSpace}>
            <div className={styles.modalSpace}>
              <label htmlFor="groupName" className={styles.modalLabel}>
                Group Name
              </label>
              <Input
                id="groupName"
                placeholder="Enter tool group name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveToolGroup();
                  }
                }}
                maxLength={120}
                autoFocus
              />
              {newGroupName.length > 100 && (
                <p className={styles.modalCharacterCount}>
                  {newGroupName.length}/120 characters
                </p>
              )}
            </div>
          </div>
          <div className={styles.modalFooter}>
            <Button
              variant="outline"
              onClick={handleCloseCreateModal}
              disabled={isCreating}
              className={styles.modalCancelButton}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveToolGroup}
              className={styles.modalCreateButton}
              disabled={!newGroupName.trim() || isCreating}
            >
              {isCreating ? "Creating..." : "Create Group"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}



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
  

  
  // Selection panel styles
  selectionPanel: "fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50",
  selectionPanelContent: "flex items-center gap-6",
  selectionInfo: "flex items-center",
  toolCounter: "flex items-center gap-2",
  toolCounterIcon: "bg-purple-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium",
  toolCounterText: "text-sm text-gray-700 font-medium",
  selectionActions: "flex items-center gap-2",
  createButton: "bg-purple-600 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm hover:bg-purple-700",
  removeButton: "border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors text-sm hover:bg-gray-50",
  
  // Modal and form styles
  modalContent: "max-w-md",
  modalSpace: "space-y-4 py-4",
  modalLabel: "text-sm font-medium",
  modalInput: "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
  modalCharacterCount: "text-xs text-gray-500",
  modalFooter: "flex justify-end gap-2",
  modalCancelButton: "px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors",
  modalCreateButton: "px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
};



