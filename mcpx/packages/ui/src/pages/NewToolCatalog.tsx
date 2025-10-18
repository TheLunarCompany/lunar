import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ToolGroupSheet } from "@/components/tools/ToolGroupSheet";
import { CustomToolDialog } from "@/components/tools/CustomToolDialog";
import { AddServerModal } from "@/components/dashboard/AddServerModal";
import { ToolDetailsDialog } from "@/components/tools/ToolDetailsDialog";
import { ToolGroupsSection } from "@/components/tools/ToolGroupsSection";
import { ToolsCatalogSection } from "@/components/tools/ToolsCatalogSection";
import { SelectionPanel } from "@/components/tools/SelectionPanel";
import { CreateToolGroupModal } from "@/components/tools/CreateToolGroupModal";
import { useToolCatalog } from "@/hooks/useToolCatalog";
import { ToolsItem } from "@/types";
import { RemoteTargetServer } from "@mcpx/shared-model";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { useRef, useState, useCallback } from "react";


interface NewToolCatalogProps {
  searchFilter?: string;
  toolsList?: Array<ToolsItem>;
  handleEditClick: (tool: ToolsItem) => void;
  handleDuplicateClick: (tool: ToolsItem) => void;
  handleDeleteTool: (tool: ToolsItem) => void;
  handleCustomizeTool: (tool: ToolsItem) => void;
}

export default function NewToolCatalog({
  searchFilter = "",
  toolsList = [],
  handleEditClick,
  handleDuplicateClick,
  handleDeleteTool,
  handleCustomizeTool,
}: NewToolCatalogProps) {
  const {
    selectedTools,
    setSelectedTools,
    showCreateModal,
    setShowCreateModal,
    newGroupName,
    setNewGroupName,
    createGroupError,
    handleNewGroupNameChange,
    isCreating,
    setIsCreating,
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
    setEditDialogMode,
    isSavingCustomTool,
    setIsSavingCustomTool,
    searchQuery,
    setSearchQuery,
    isAddServerModalOpen,
    setIsAddServerModalOpen,
    isToolDetailsDialogOpen,
    setIsToolDetailsDialogOpen,
    selectedToolForDetails,
    setSelectedToolForDetails,
    editingGroup,
    setEditingGroup,
    originalSelectedTools,
    setOriginalSelectedTools,
    isSavingGroupChanges,
    setIsSavingGroupChanges,

    providers,
    totalFilteredTools,
    transformedToolGroups,
    toolGroups,
    areSetsEqual,

    handleToolSelectionChange,
    handleCreateToolGroup,
    handleSaveToolGroup,
    handleCloseCreateModal,
    handleGroupNavigation,
    handleGroupClick,
    handleProviderClick,
    handleEditGroup,
    handleDeleteGroup,
    handleUpdateGroupName,
    handleUpdateGroupDescription,
    handleSaveGroupChanges,
    handleCancelGroupEdit,

    handleCreateCustomTool,
    handleEditCustomTool,
    handleSaveCustomTool,
    handleDuplicateCustomTool,
    handleCustomizeToolDialog,
    handleClickAddCustomToolMode,
    handleCancelAddCustomToolMode,
    isAddCustomToolMode,
    selectedCustomToolKey,
    setSelectedCustomToolKey,
  } = useToolCatalog(toolsList);

  // Handle tool customization/edit based on tool type
  const handleToolAction = (tool: any) => {

    if (tool.isCustom) {
      handleEditCustomTool(tool);
    } else {

      handleCancelAddCustomToolMode(); // Exit add custom tool mode

      // Dismiss the add custom tool toast
      if (toastRef2.current) {
        toastRef2.current.dismiss?.();
        toastRef2.current = null;
      }

      handleCustomizeToolDialog(tool);
    }
  };

  const handleCloseCustomToolFullDialog = () => {
    setIsCustomToolFullDialogOpen(false);
    setEditingToolData(null);
  };

  const handleCloseEditCustomToolDialog = () => {
    setIsEditCustomToolDialogOpen(false);
    setEditingToolData(null);
  };

  const handleToolClick = (tool: ToolsItem) => {
    setSelectedToolForDetails(tool);
    setIsToolDetailsDialogOpen(true);
  };

  const toastRef = useRef<ReturnType<typeof toast> | null>(null);
  const toastRef2 = useRef<ReturnType<typeof toast> | null>(null);

  // Track recently customized tools for loading animation
  const [recentlyCustomizedTools, setRecentlyCustomizedTools] = useState<Set<string>>(new Set());

  // Wrapper function to trigger loading animation after customization
  const handleCreateCustomToolWithLoading = useCallback(async (toolData: any) => {
    await handleCreateCustomTool(toolData);

    // Trigger loading animation for the customized tool
    if (toolData) {
      const toolKey = `${toolData.server}:${toolData.name}`;
      setRecentlyCustomizedTools(prev => new Set([...prev, toolKey]));

      // Clear the loading trigger after animation completes
      setTimeout(() => {
        setRecentlyCustomizedTools(prev => {
          const newSet = new Set(prev);
          newSet.delete(toolKey);
          return newSet;
        });
      }, 3000); // Wait longer than skeleton duration
    }
  }, [handleCreateCustomTool]);

  // Wrapper function to trigger loading animation after editing custom tools
  const handleSaveCustomToolWithLoading = useCallback(async (toolData: any) => {
    await handleSaveCustomTool(toolData);

    // Trigger loading animation for the edited tool
    if (toolData) {
      // Use current name since that's what the UI will show after update
      const toolKey = `${toolData.server}:${toolData.name}`;
      setRecentlyCustomizedTools(prev => new Set([...prev, toolKey]));

      // Clear the loading trigger after animation completes
      setTimeout(() => {
        setRecentlyCustomizedTools(prev => {
          const newSet = new Set(prev);
          newSet.delete(toolKey);
          return newSet;
        });
      }, 3000); // Wait longer than skeleton duration
    }
  }, [handleSaveCustomTool]);

const handleClickCreateNewTollGroup = ()=>{
  setIsEditMode(true);
  const newExpanded = new Set(providers.map(provider=>provider.name))
  setExpandedProviders(newExpanded);
}
const handleClickAddCustomTool = () => {
    if (isAddCustomToolMode) {
      handleCancelAddCustomToolMode();
      setSelectedTools(new Set());
      setSelectedCustomToolKey(null);
      setExpandedProviders(new Set());
      setIsCustomToolFullDialogOpen(false);
      setEditingToolData(null);
      if (toastRef2.current) {
        toastRef2.current.dismiss?.();
        toastRef2.current = null;
      }
      return;
    }

    handleClickAddCustomToolMode();

    toastRef2.current = toast({
      title: "Add Custom Tool",
      description: `Select 1 tool to customize`,
      isClosable: false,
      duration: 1000000,
      variant: "info",
      position: "top-center",
    });
  };

  const handleClickCreateToolGroup = ()=>{
    if(toastRef.current){
      toastRef.current?.dismiss();
    }
    if (isEditMode) {

      handleCancelGroupEdit();
    } else {
      setIsEditMode(true);

      toastRef.current =  toast({
      title: "Create New Tool Group",
      description: `Select severs to add to the new tool group`,
      isClosable: false,
      duration : 1000000, // prevent toast disappear
      variant:"info", // added new variant
  
      position: "top-center",
    });
      const newExpanded = new Set(providers.map(provider=>provider.name))
      setExpandedProviders(newExpanded);
    }


  }
  return (
    <>

      <div className={`${styles.container} bg-gray-100`}>
        <div className={styles.content}>
          <div className="mb-6">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold text-gray-900">
                Tool Catalog
              </h1>
            </div>

            {/* Search Bar */}
            <div className="mt-6 flex justify-between  gap-2">
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search for tool..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4F33CC] focus:border-transparent bg-white"
                />
              </div>


              <div className="flex justify-end gap-3">
                <Button
                  onClick={handleClickAddCustomTool}
                  disabled={isEditMode}
                  className={`border-[#5147E4] border-2 text-[#5147E4] hover:bg-[#45147E4] hover:!text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm bg-transparent ${isEditMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isAddCustomToolMode ? "Cancel" : "Add Custom Tool"}
                </Button>
                <Button
                  onClick={handleClickCreateToolGroup}
                  disabled={isAddCustomToolMode}
                  className={`${styles.editModeButton} ${isAddCustomToolMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isEditMode ? "Cancel" : "Create Tool Group"}
                </Button>
              </div>

            </div>



          </div>







          <ToolGroupsSection
               onEditGroup={handleEditGroup}
               onDeleteGroup={handleDeleteGroup}
            providers={providers as RemoteTargetServer[]}
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
            selectedToolGroupForDialog={selectedToolGroupForDialog}
          />

          <ToolsCatalogSection
            providers={providers as RemoteTargetServer[]}
            totalFilteredTools={totalFilteredTools}
            selectedToolGroup={selectedToolGroup}
            toolGroups={toolGroups}
            expandedProviders={expandedProviders}
            isEditMode={isEditMode}
            isAddCustomToolMode={isAddCustomToolMode}
            selectedTools={selectedTools}
            searchQuery={searchQuery}
            onProviderClick={handleProviderClick}
            onToolSelectionChange={handleToolSelectionChange}
            onEditClick={handleEditCustomTool}
            onDuplicateClick={handleDuplicateCustomTool}
            onDeleteTool={handleDeleteTool}
            onCustomizeTool={handleToolAction}
            onToolClick={handleToolClick}
            onAddServerClick={() => setIsAddServerModalOpen(true)}
            onShowAllTools={() => setSelectedToolGroup(null)}
            onAddCustomToolClick={() => {
              console.log("[NewToolCatalog] Opening custom tool dialog");
              setIsCustomToolFullDialogOpen(true);
            }}
            recentlyCustomizedTools={recentlyCustomizedTools}
            onEditModeToggle={() => {
              if (isEditMode) {
                handleCancelGroupEdit();
              } else {
                setIsEditMode(true);
              }
            }}
            selectedToolForDetails={selectedToolForDetails}
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
              const tool = provider?.originalTools.find((t: any) => t.name === toolName);
              if (!tool) return;

              // Exit add custom tool mode before opening the dialog
              handleCancelAddCustomToolMode();

              // Dismiss the add custom tool toast
              if (toastRef2.current) {
                toastRef2.current.dismiss?.();
                toastRef2.current = null;
              }

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
        error={createGroupError}
        onSave={handleSaveToolGroup}
        isCreating={isCreating}
        selectedToolsCount={selectedTools.size}
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
        onDeleteGroup={handleDeleteGroup}
        onUpdateGroupName={handleUpdateGroupName}
        onUpdateGroupDescription={handleUpdateGroupDescription}
        isViewOnly={true}
      />

      {/* Add Server Modal */}
      {isAddServerModalOpen && (
        <AddServerModal
          onClose={() => setIsAddServerModalOpen(false)}
        />
      )}

      {/* Tool Details Dialog */}
      {selectedToolForDetails && (
        <ToolDetailsDialog
          isOpen={isToolDetailsDialogOpen}
          onClose={() => {
            setIsToolDetailsDialogOpen(false);
            setSelectedToolForDetails(null);
          }}
          tool={selectedToolForDetails}
          providers={providers}
          onEdit={() => {
            setIsToolDetailsDialogOpen(false);
            handleEditCustomTool(selectedToolForDetails);
          }}
          onDuplicate={() => {
            setIsToolDetailsDialogOpen(false);
            handleDuplicateCustomTool(selectedToolForDetails);
          }}
          onDelete={() => {
            setIsToolDetailsDialogOpen(false);
            handleDeleteTool(selectedToolForDetails);
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
  content: "container mx-auto py-8 px-4",

  // Header styles
  header: "flex justify-between items-start gap-12 whitespace-nowrap mb-0",
  title: "text-3xl font-bold tracking-tight",
  titleSection: "flex flex-col gap-2",
  filterInfo: "flex flex-wrap items-center gap-2 text-sm mb-2",
  filterBadge:
    "bg-[#4F33CC1A] text-[#4F33CC] px-2 py-1 rounded-full font-medium",
  searchTerm: "bg-gray-200 text-gray-700 px-2 py-1 rounded",
  customToolsFilter:
    "bg-[#4F33CC1A] text-[#4F33CC] px-2 py-1 rounded-full font-medium",
  editModeButton:
    " bg-[#5147E4] text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm",
  editModeButtonActive: "bg-[#4F33CC] text-white hover:bg-[#4F33CC]",
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
  statusBadgeConnected:
    "bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium ml-8 mr-2",
  statusBadgePending:
    "bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-medium ml-12 mr-2",
  statusBadgeFailed:
    "bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-medium ml-8 mr-2",
  statusBadgeUnauthorized:
    "bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 ml-8 mr-2",
  statusBadgeIcon: "w-3 h-3",

  // Tools container styles
  toolsContainer:
    "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-2",
  toolWrapper: "w-full",
  scrollIndicator: "hidden",
  scrollIcon: "w-5 h-5 text-gray-400",
  noToolsMessage: "col-span-full text-center py-8 text-gray-500 text-sm",

  // Selection panel styles
  selectionPanel:
    "fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50",
  selectionPanelContent: "flex items-center gap-6",
  selectionInfo: "flex items-center",
  toolCounter: "flex items-center gap-2",
  toolCounterIcon:
    "bg-[#4F33CC] text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium",
  toolCounterText: "text-sm text-gray-700 font-medium",
  selectionActions: "flex items-center gap-2",
  createButton:
    "bg-[#4F33CC] text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm hover:bg-[#4F33CC]",
  removeButton:
    "border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors text-sm hover:bg-gray-50",

  // Modal and form styles
  modalContent: "max-w-md",
  modalSpace: "space-y-4 py-4",
  modalLabel: "text-sm font-medium",
  modalInput:
    "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
  modalCharacterCount: "text-xs text-gray-500",
  modalFooter: "flex justify-end gap-2",
  modalCancelButton:
    "px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors",
  modalCreateButton:
    "px-4 py-2 bg-[#4F33CC] text-white rounded-md text-sm font-medium hover:bg-[#4F33CC] transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
};
