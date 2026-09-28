import { Loader2, Plus } from "lucide-react";
import { ToolGroupSheet } from "@/components/tools/ToolGroupSheet";
import { CustomToolDialog } from "@/components/tools/CustomToolDialog";
import { AddServerModal } from "@/components/dashboard/AddServerModal";
import { ToolDetailsDialog } from "@/components/tools/ToolDetailsDialog";
import { ToolGroupsSection } from "@/components/tools/ToolGroupsSection";
import { ToolsCatalogSection } from "@/components/tools/ToolsCatalogSection";
import { SelectionPanel } from "@/components/tools/SelectionPanel";
import { CreateToolGroupModal } from "@/components/tools/CreateToolGroupModal";
import { EditToolGroupModal } from "@/components/tools/EditToolGroupModal";
import { toast, useToast } from "@/components/ui/use-toast";
import { Banner } from "@/components/ui/banner";
import { useToolCatalog } from "@/hooks/useToolCatalog";
import { isServerInactive } from "@/hooks/useServerInactive";
import { ToolsItem } from "@/types";
import type { ToolCardTool } from "@/components/tools/ToolCard";
import { TargetServer } from "@mcpx/shared-model";
import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSocketStore } from "@/store";

interface NewToolCatalogProps {
  searchFilter?: string;
  toolsList?: Array<ToolsItem>;
  handleEditClick: (tool: ToolsItem) => void;
  handleDuplicateClick: (tool: ToolsItem) => void;
  handleDeleteTool: (tool: ToolsItem) => void;
  handleCustomizeTool: (tool: ToolsItem) => void;
  dismissDeleteToast?: () => void;
  onToolGroupEditModeChange?: (
    isEdit: boolean,
    cancelHandler: () => void,
  ) => void;
}

// Type for tool data in create/save handlers
type CustomToolData = {
  server: string;
  tool: string;
  name: string;
  description: string;
  parameters: Array<{ name: string; description: string; value: string }>;
  originalName?: string;
};

export default function NewToolCatalog({
  toolsList = [],
  dismissDeleteToast,
  onToolGroupEditModeChange,
}: NewToolCatalogProps) {
  useToast(); // Hook must be called even if not using its return

  const {
    selectedTools,
    setSelectedTools,
    showCreateModal,
    newGroupName,
    newGroupDescription,
    handleNewGroupDescriptionChange,
    createGroupError,
    handleNewGroupNameChange,
    isCreating,
    showEditGroupModal,
    editingGroupName,
    editingGroupDescription,
    handleOpenEditGroupModal,
    handleCloseEditGroupModal,
    handleEditGroupNameChange,
    handleEditGroupDescriptionChange,
    handleSaveGroupNameChanges,
    editGroupError,
    isSavingGroupName,
    currentGroupIndex,
    setCurrentGroupIndex,
    selectedToolGroup,
    setSelectedToolGroup,
    expandedProviders,
    setExpandedProviders,
    isToolGroupDialogOpen,
    setIsToolGroupDialogOpen,
    selectedToolGroupForDialog,
    setSelectedToolGroupForDialog,
    isEditMode,
    setIsEditMode,
    isCustomToolFullDialogOpen,
    setIsCustomToolFullDialogOpen,
    isEditCustomToolDialogOpen,
    setIsEditCustomToolDialogOpen,
    editingToolData,
    setEditingToolData,
    editDialogMode,
    isSavingCustomTool,
    searchQuery,
    setSearchQuery,
    annotationFilter,
    setAnnotationFilter,
    isAddServerModalOpen,
    setIsAddServerModalOpen,
    isToolDetailsDialogOpen,
    setIsToolDetailsDialogOpen,
    selectedToolForDetails,
    setSelectedToolForDetails,
    editingGroup,
    originalSelectedTools,
    isSavingGroupChanges,

    providers,
    transformedToolGroups,
    toolGroups,
    areSetsEqual,

    handleToolSelectionChange,
    handleSelectAllTools,
    handleCreateToolGroup,
    handleSaveToolGroup,
    handleCloseCreateModal,
    handleGroupNavigation,
    handleGroupClick,
    handleProviderClick,
    handleEditGroup,
    handleDeleteGroup,
    handleSaveGroupChanges,
    handleCancelGroupEdit,

    handleCreateCustomTool,
    handleEditCustomTool,
    handleSaveCustomTool,
    handleDeleteCustomTool,
    handleDuplicateCustomTool,
    handleCustomizeToolDialog,
    handleClickAddCustomToolMode,
    handleCancelAddCustomToolMode,
    isAddCustomToolMode,
    selectedCustomToolKey,
    setSelectedCustomToolKey,
    toolGroupOperation,
  } = useToolCatalog(toolsList);

  const appConfig = useSocketStore((s) => s.appConfig);

  const inactiveProviderNames = useMemo(() => {
    const set = new Set<string>();
    for (const p of providers) {
      if (isServerInactive(p.name, appConfig)) set.add(p.name);
    }
    return set;
  }, [providers, appConfig]);

  // Notify parent about edit mode changes
  useEffect(() => {
    if (onToolGroupEditModeChange) {
      onToolGroupEditModeChange(isEditMode, handleCancelGroupEdit);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode]);

  // Wrapper for delete tool that uses handleDeleteCustomTool from useToolCatalog
  const handleDeleteToolWrapper = async (tool: ToolCardTool) => {
    // Dismiss delete toast when deleting
    dismissDeleteToast?.();

    // Use the handler from useToolCatalog which has the loader logic
    await handleDeleteCustomTool(tool);
  };

  // Handle tool customization/edit based on tool type
  const handleToolAction = (tool: ToolCardTool) => {
    if (tool.isCustom) {
      // Dismiss delete toast when editing custom tool
      dismissDeleteToast?.();
      handleEditCustomTool(tool);
    } else {
      handleCancelAddCustomToolMode(); // Exit add custom tool mode

      handleCustomizeToolDialog(tool);
    }
  };

  const handleCloseCustomToolFullDialog = () => {
    // Dismiss delete toast when closing the custom tool dialog
    dismissDeleteToast?.();

    setIsCustomToolFullDialogOpen(false);
    setEditingToolData(null);
  };

  const handleCloseEditCustomToolDialog = () => {
    // Dismiss delete toast when closing the edit custom tool dialog
    dismissDeleteToast?.();

    setIsEditCustomToolDialogOpen(false);
    setEditingToolData(null);
  };

  const handleToolClick = (tool: ToolCardTool) => {
    // Dismiss delete toast when opening details drawer for custom tools
    if (tool.isCustom) {
      dismissDeleteToast?.();
    }

    setSelectedToolForDetails(tool);
    setIsToolDetailsDialogOpen(true);
  };

  const toastRef = useRef<ReturnType<typeof toast> | null>(null);

  // Track recently customized tools for loading animation
  const [recentlyCustomizedTools, setRecentlyCustomizedTools] = useState<
    Set<string>
  >(new Set());

  // Track tools that are currently being customized (dialog is open)
  const currentlyCustomizingTools = useMemo(() => {
    const customizing = new Set<string>();
    if (
      editingToolData &&
      (isCustomToolFullDialogOpen || isEditCustomToolDialogOpen)
    ) {
      // For editing custom tools, use the custom name (editingToolData.name)
      // For creating new custom tools, use the tool name (editingToolData.tool)
      const toolName = editingToolData.name || editingToolData.tool;
      customizing.add(`${editingToolData.server}:${toolName}`);
    }
    return customizing;
  }, [editingToolData, isCustomToolFullDialogOpen, isEditCustomToolDialogOpen]);

  // Wrapper function to trigger loading animation after customization
  const handleCreateCustomToolWithLoading = useCallback(
    async (toolData: CustomToolData) => {
      await handleCreateCustomTool(toolData);

      // Trigger loading animation for the customized tool
      if (toolData) {
        const toolKey = `${toolData.server}:${toolData.name}`;
        setRecentlyCustomizedTools((prev) => new Set([...prev, toolKey]));

        // Clear the loading trigger after animation completes
        setTimeout(() => {
          setRecentlyCustomizedTools((prev) => {
            const newSet = new Set(prev);
            newSet.delete(toolKey);
            return newSet;
          });
        }, 3000); // Wait longer than skeleton duration
      }
    },
    [handleCreateCustomTool],
  );

  // Wrapper function to trigger loading animation after editing custom tools
  const handleSaveCustomToolWithLoading = useCallback(
    async (toolData: CustomToolData) => {
      await handleSaveCustomTool(toolData);

      // Trigger loading animation for the edited tool
      if (toolData) {
        // Use current name since that's what the UI will show after update
        const toolKey = `${toolData.server}:${toolData.name}`;
        setRecentlyCustomizedTools((prev) => new Set([...prev, toolKey]));

        // Clear the loading trigger after animation completes
        setTimeout(() => {
          setRecentlyCustomizedTools((prev) => {
            const newSet = new Set(prev);
            newSet.delete(toolKey);
            return newSet;
          });
        }, 3000); // Wait longer than skeleton duration
      }
    },
    [handleSaveCustomTool],
  );

  const handleClickCreateNewTollGroup = () => {
    setIsEditMode(true);
    const newExpanded = new Set(providers.map((provider) => provider.name));
    setExpandedProviders(newExpanded);
  };
  const handleClickAddCustomTool = () => {
    if (isAddCustomToolMode) {
      handleCancelAddCustomToolMode();
      setSelectedTools(new Set());
      setSelectedCustomToolKey(null);
      setExpandedProviders(new Set());
      setIsCustomToolFullDialogOpen(false);
      setEditingToolData(null);
      return;
    }

    handleClickAddCustomToolMode();
  };

  const handleClickCreateToolGroup = () => {
    if (toastRef.current) {
      toastRef.current?.dismiss();
    }
    if (isEditMode) {
      handleCancelGroupEdit();
    } else {
      setIsEditMode(true);
      // Only expand providers that have tools (tools.length > 0)
      const newExpanded = new Set(
        providers
          .filter((provider) => (provider.originalTools?.length || 0) > 0)
          .map((provider) => provider.name),
      );
      setExpandedProviders(newExpanded);
    }
  };
  return (
    <>
      {/* Full-page loader overlay for tool group operations */}
      {isCreating && toolGroupOperation && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center bg-[var(--mcpx-scrim)]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-mcpx-info-text" />
            <p className="text-lg font-medium text-mcpx-text-secondary">
              {toolGroupOperation === "creating" && "Creating tool group..."}
              {toolGroupOperation === "editing" && "Updating tool group..."}
              {toolGroupOperation === "deleting" && "Deleting tool group..."}
              {!toolGroupOperation && "Processing..."}
            </p>
          </div>
        </div>
      )}

      {isAddCustomToolMode && (
        <div className="px-6 pt-6">
          <Banner description="Add custom tool. Select 1 tool to customize" />
        </div>
      )}

      <div
        data-testid="new-tool-catalog-container"
        className={`${styles.container} bg-mcpx-surface p-6`}
      >
        <div className={styles.content}>
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <h1 className="mcpx-page-title">Tools</h1>
              <div className="flex gap-3">
                {!isEditMode && !showCreateModal && (
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={handleClickAddCustomTool}
                  >
                    {!isAddCustomToolMode && <Plus />}
                    {isAddCustomToolMode ? "Cancel" : "Add Custom Tool"}
                  </Button>
                )}
                {!isAddCustomToolMode && (
                  <Button
                    type="button"
                    size="lg"
                    onClick={handleClickCreateToolGroup}
                    disabled={isAddCustomToolMode}
                  >
                    {!isEditMode && <Plus />}
                    {isEditMode ? "Cancel" : "Create Tool Group"}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <ToolGroupsSection
            onEditGroup={handleEditGroup}
            onEditToolGroup={handleOpenEditGroupModal}
            onDeleteGroup={handleDeleteGroup}
            providers={providers as TargetServer[]}
            transformedToolGroups={transformedToolGroups}
            toolGroups={toolGroups}
            currentGroupIndex={currentGroupIndex}
            selectedToolGroup={selectedToolGroup}
            onGroupNavigation={handleGroupNavigation}
            onGroupClick={handleGroupClick}
            onEditModeToggle={handleClickCreateNewTollGroup}
            isEditMode={isEditMode}
            isAddCustomToolMode={isAddCustomToolMode}
            setCurrentGroupIndex={setCurrentGroupIndex}
            selectedToolGroupForDialog={selectedToolGroupForDialog ?? undefined}
          />

          <ToolsCatalogSection
            providers={providers as TargetServer[]}
            selectedToolGroup={selectedToolGroup}
            toolGroups={toolGroups}
            expandedProviders={expandedProviders}
            inactiveProviderNames={inactiveProviderNames}
            isEditMode={isEditMode}
            isAddCustomToolMode={isAddCustomToolMode}
            selectedTools={selectedTools}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            annotationFilter={annotationFilter}
            onAnnotationFilterChange={setAnnotationFilter}
            onProviderClick={handleProviderClick}
            onToolSelectionChange={handleToolSelectionChange}
            onSelectAllTools={handleSelectAllTools}
            onEditClick={(tool) => handleEditCustomTool(tool)}
            onDuplicateClick={(tool) => handleDuplicateCustomTool(tool)}
            onDeleteTool={handleDeleteToolWrapper}
            onCustomizeTool={(tool) => handleToolAction(tool)}
            onToolClick={handleToolClick}
            onAddServerClick={() => setIsAddServerModalOpen(true)}
            onShowAllTools={() => setSelectedToolGroup(null)}
            onAddCustomToolClick={() => setIsCustomToolFullDialogOpen(true)}
            recentlyCustomizedTools={recentlyCustomizedTools}
            currentlyCustomizingTools={currentlyCustomizingTools}
            onEditModeToggle={() => {
              if (isEditMode) {
                handleCancelGroupEdit();
              } else {
                setIsEditMode(true);
              }
            }}
            selectedToolForDetails={selectedToolForDetails ?? undefined}
          />

          <SelectionPanel
            selectedTools={selectedTools}
            isAddCustomToolMode={isAddCustomToolMode}
            editingGroup={editingGroup}
            originalSelectedTools={originalSelectedTools}
            isSavingGroupChanges={isSavingGroupChanges}
            areSetsEqual={areSetsEqual}
            showCreateModal={showCreateModal}
            onSaveGroupChanges={handleSaveGroupChanges}
            onClearSelection={() => {
              setSelectedTools(new Set());
              setSelectedCustomToolKey(null);
            }}
            onCreateToolGroup={() => {
              handleCreateToolGroup();
            }}
            onCustomizeSelectedTool={() => {
              if (!selectedCustomToolKey) return;
              const [providerName, toolName] = selectedCustomToolKey.split(":");
              const provider = providers.find((p) => p.name === providerName);
              const tool = provider?.originalTools.find(
                (t) => t.name === toolName,
              );
              if (!tool) return;

              // Exit add custom tool mode before opening the dialog
              handleCancelAddCustomToolMode();

              handleCustomizeToolDialog({
                name: tool.name,
                serviceName: providerName,
                inputSchema: tool.inputSchema,
                description: tool.description,
              });
            }}
          />
        </div>
      </div>

      <CreateToolGroupModal
        isOpen={showCreateModal}
        onClose={handleCloseCreateModal}
        newGroupName={newGroupName}
        onGroupNameChange={handleNewGroupNameChange}
        newGroupDescription={newGroupDescription}
        onGroupDescriptionChange={handleNewGroupDescriptionChange}
        error={createGroupError}
        onSave={handleSaveToolGroup}
        isCreating={isCreating}
        selectedToolsCount={selectedTools.size}
      />

      <EditToolGroupModal
        isOpen={showEditGroupModal}
        onClose={handleCloseEditGroupModal}
        groupName={editingGroupName}
        onGroupNameChange={handleEditGroupNameChange}
        groupDescription={editingGroupDescription}
        onGroupDescriptionChange={handleEditGroupDescriptionChange}
        error={editGroupError}
        onSave={handleSaveGroupNameChanges}
        isSaving={isSavingGroupName}
      />

      {/* Tool Group Side Sheet */}
      <ToolGroupSheet
        isOpen={isToolGroupDialogOpen}
        onOpenChange={(open) => {
          setIsToolGroupDialogOpen(open);
          if (!open) {
            setSelectedToolGroupForDialog(null);
          }
        }}
        selectedToolGroup={selectedToolGroupForDialog}
        toolGroups={toolGroups}
        providers={providers}
        onEditGroup={handleEditGroup}
        onEditToolGroup={handleOpenEditGroupModal}
        onDeleteGroup={handleDeleteGroup}
      />

      {/* Add Server Modal */}
      {isAddServerModalOpen && (
        <AddServerModal onClose={() => setIsAddServerModalOpen(false)} />
      )}

      {/* Tool Details Dialog */}
      {selectedToolForDetails && (
        <ToolDetailsDialog
          isOpen={isToolDetailsDialogOpen}
          onClose={() => {
            // Dismiss delete toast when closing details drawer for custom tools
            if (selectedToolForDetails?.isCustom) {
              dismissDeleteToast?.();
            }
            setIsToolDetailsDialogOpen(false);
            setSelectedToolForDetails(null);
          }}
          tool={selectedToolForDetails}
          appConfig={appConfig}
          providers={providers}
          onEdit={() => {
            setIsToolDetailsDialogOpen(false);
            // Dismiss delete toast when editing from tool details dialog
            dismissDeleteToast?.();
            handleEditCustomTool(selectedToolForDetails);
          }}
          onDuplicate={() => {
            setIsToolDetailsDialogOpen(false);
            // Dismiss delete toast when duplicating from tool details dialog
            dismissDeleteToast?.();
            handleDuplicateCustomTool(selectedToolForDetails);
          }}
          onDelete={() => {
            setIsToolDetailsDialogOpen(false);
            if (selectedToolForDetails) {
              handleDeleteToolWrapper(selectedToolForDetails);
            }
          }}
          onCustomize={() => {
            setIsToolDetailsDialogOpen(false);
            handleCustomizeToolDialog(selectedToolForDetails);
          }}
        />
      )}

      {/* Custom Tool Dialogs - Moved to end for proper positioning */}
      <CustomToolDialog
        isOpen={isCustomToolFullDialogOpen}
        onOpenChange={handleCloseCustomToolFullDialog}
        providers={providers}
        onClose={handleCloseCustomToolFullDialog}
        onCreate={handleCreateCustomToolWithLoading}
        editDialogMode={editDialogMode}
        preSelectedServer={editingToolData?.server}
        preSelectedTool={editingToolData?.tool}
        preFilledData={
          editingToolData
            ? {
                name: editingToolData.name,
                description: editingToolData.description,
                parameters: editingToolData.parameters,
              }
            : undefined
        }
        isLoading={isSavingCustomTool}
      />

      <CustomToolDialog
        isOpen={isEditCustomToolDialogOpen}
        onOpenChange={handleCloseEditCustomToolDialog}
        providers={providers}
        onClose={handleCloseEditCustomToolDialog}
        onCreate={handleSaveCustomToolWithLoading}
        editDialogMode={editDialogMode}
        preSelectedServer={editingToolData?.server}
        preSelectedTool={editingToolData?.tool}
        preFilledData={
          editingToolData
            ? {
                name: editingToolData.name,
                description: editingToolData.description,
                parameters: editingToolData.parameters,
              }
            : undefined
        }
        isLoading={isSavingCustomTool}
      />
    </>
  );
}

const styles = {
  // Container styles
  container: " w-full relative",
  content: "w-full",

  // Header styles
  header: "flex justify-between items-start gap-12 whitespace-nowrap mb-0",
  filterInfo: "flex flex-wrap items-center gap-2 text-sm mb-2",
  filterBadge:
    "bg-mcpx-selected-weak text-mcpx-selected px-2 py-1 rounded-full font-medium",
  searchTerm:
    "bg-mcpx-surface-disabled text-mcpx-text-secondary px-2 py-1 rounded",
  customToolsFilter:
    "bg-mcpx-selected-weak text-mcpx-selected px-2 py-1 rounded-full font-medium",
  // Empty state styles
  emptyState: "text-center py-12",
  emptyStateTitle: "text-mcpx-text-tertiary text-lg",
  emptyStateSubtitle: "text-mcpx-text-disabled text-sm mt-2",

  // Accordion styles
  accordion: "space-y-4",
  accordionItem: "border-b border-mcpx-border-subtle",
  accordionTrigger: "hover:no-underline",
  accordionHeader: "flex items-center justify-between gap-3 flex-1",
  providerInfo: "flex items-center gap-3 flex-1",
  providerIcon: "text-xl",
  providerName: "font-semibold text-mcpx-text",

  // Status badge styles
  statusBadgeConnected:
    "bg-mcpx-success-bg text-mcpx-success-text text-xs px-2 py-1 rounded-full font-medium ml-8 mr-2",
  statusBadgePending:
    "bg-mcpx-warning-bg text-mcpx-warning-strong text-xs px-2 py-1 rounded-full font-medium ml-12 mr-2",
  statusBadgeFailed:
    "bg-mcpx-danger-bg text-mcpx-danger-text text-xs px-2 py-1 rounded-full font-medium ml-8 mr-2",
  statusBadgeUnauthorized:
    "bg-mcpx-page0 text-mcpx-text-secondary text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 ml-8 mr-2",
  statusBadgeIcon: "w-3 h-3",

  // Tools container styles
  toolsContainer:
    "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-2",
  toolWrapper: "w-full",
  scrollIndicator: "hidden",
  scrollIcon: "w-5 h-5 text-mcpx-text-disabled",
  noToolsMessage:
    "col-span-full text-center py-8 text-mcpx-text-tertiary text-sm",

  // Selection panel styles
  selectionPanel:
    "fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-mcpx-surface border border-mcpx-border-subtle rounded-lg shadow-[var(--mcpx-shadow-moderate)] p-4 z-50",
  selectionPanelContent: "flex items-center gap-6",
  selectionInfo: "flex items-center",
  toolCounter: "flex items-center gap-2",
  toolCounterIcon:
    "bg-mcpx-selected text-mcpx-tooltip-text w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium",
  toolCounterText: "text-sm text-mcpx-text-secondary font-medium",
  selectionActions: "flex items-center gap-2",
  createButton:
    "bg-mcpx-selected text-mcpx-tooltip-text px-4 py-2 rounded-lg font-medium transition-colors text-sm hover:bg-mcpx-selected",
  removeButton:
    "border-mcpx-border text-mcpx-text-secondary px-4 py-2 rounded-lg font-medium transition-colors text-sm hover:bg-mcpx-surface-subtle",

  // Modal and form styles
  modalContent: "max-w-md",
  modalSpace: "space-y-4 py-4",
  modalLabel: "text-sm font-medium",
  modalInput:
    "w-full px-3 py-2 border border-mcpx-border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-mcpx-focus",
  modalCharacterCount: "text-xs text-mcpx-text-tertiary",
  modalFooter: "flex justify-end gap-2",
  modalCancelButton:
    "px-4 py-2 border border-mcpx-border rounded-md text-sm font-medium text-mcpx-text-secondary bg-mcpx-surface hover:bg-mcpx-surface-subtle transition-colors",
  modalCreateButton:
    "px-4 py-2 bg-mcpx-selected text-mcpx-tooltip-text rounded-md text-sm font-medium hover:bg-mcpx-selected transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
};
