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
    handleSaveGroupChanges,
    handleCancelGroupEdit,

    handleCreateCustomTool,
    handleEditCustomTool,
    handleSaveCustomTool,
    handleDuplicateCustomTool,
    handleCustomizeToolDialog,
  } = useToolCatalog(toolsList);


  const handleCloseCustomToolFullDialog = () => {
    setIsCustomToolFullDialogOpen(false);
  };

  const handleCloseEditCustomToolDialog = () => {
    setIsEditCustomToolDialogOpen(false);
    setEditingToolData(null);
  };

  const handleToolClick = (tool: ToolsItem) => {
    setSelectedToolForDetails(tool);
    setIsToolDetailsDialogOpen(true);
  };

const handleClickCreateNewTollGroup = ()=>{
  setIsEditMode(true);
  const newExpanded = new Set(providers.map(provider=>provider.name))
  setExpandedProviders(newExpanded);
}

  const handleClickCreateToolGroup = ()=>{
    if (isEditMode) {
      handleCancelGroupEdit();
    } else {
      setIsEditMode(true);
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
              {editingGroup && (
                <div className="flex items-center gap-2 px-3 py-1 bg-[#4F33CC1A] border border-[#4F33CC] rounded-lg">
                  <div className="w-2 h-2 #4F33CC  rounded-full"></div>
                  <span className="text-sm font-medium text-[#4F33CC]">
                    Editing: {editingGroup.name}
                  </span>
                </div>
              )}
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
                  onClick={ () => setIsCustomToolFullDialogOpen(true)}
                  className="border-[#5147E4] border-2 text-[#5147E4] hover:bg-[#45147E4] hover:!text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm bg-transparent"
                >
                  Add Custom Tool
                </Button>
                <Button onClick={handleClickCreateToolGroup} className={styles.editModeButton}>
                  {isEditMode ? "Cancel" : "Create Tool Group"}
                </Button>
              </div>

            </div>



          </div>







          <ToolGroupsSection
            transformedToolGroups={transformedToolGroups}
            currentGroupIndex={currentGroupIndex}
            selectedToolGroup={selectedToolGroup}
            onGroupNavigation={handleGroupNavigation}
            onGroupClick={handleGroupClick}
            onEditModeToggle={handleClickCreateNewTollGroup}
            isEditMode={isEditMode}
            setCurrentGroupIndex={setCurrentGroupIndex}
          />

          <ToolsCatalogSection
            providers={providers as RemoteTargetServer[]}
            totalFilteredTools={totalFilteredTools}
            selectedToolGroup={selectedToolGroup}
            toolGroups={toolGroups}
            expandedProviders={expandedProviders}
            isEditMode={isEditMode}
            selectedTools={selectedTools}
            searchQuery={searchQuery}
            onProviderClick={handleProviderClick}
            onToolSelectionChange={handleToolSelectionChange}
            onEditClick={handleEditCustomTool}
            onDuplicateClick={handleDuplicateCustomTool}
            onDeleteTool={handleDeleteTool}
            onCustomizeTool={handleCustomizeToolDialog}
            onToolClick={handleToolClick}
            onAddServerClick={() => setIsAddServerModalOpen(true)}
            onShowAllTools={() => setSelectedToolGroup(null)}
            onAddCustomToolClick={() => setIsCustomToolFullDialogOpen(true)}
            onEditModeToggle={() => {
              if (isEditMode) {
                handleCancelGroupEdit();
              } else {
                setIsEditMode(true);
              }
            }}
          />

          <SelectionPanel
            selectedTools={selectedTools}
            editingGroup={editingGroup}
            originalSelectedTools={originalSelectedTools}
            isSavingGroupChanges={isSavingGroupChanges}
            areSetsEqual={areSetsEqual}
            onSaveGroupChanges={handleSaveGroupChanges}
            onClearSelection={() => setSelectedTools(new Set())}
            onCreateToolGroup={handleCreateToolGroup}
          />
        </div>
      </div>

      <CreateToolGroupModal
        isOpen={showCreateModal}
        onClose={handleCloseCreateModal}
        newGroupName={newGroupName}
        onGroupNameChange={setNewGroupName}
        onSave={handleSaveToolGroup}
        isCreating={isCreating}
        selectedToolsCount={selectedTools.size}
      />

      {/* Tool Group Side Sheet */}
      <ToolGroupSheet
        isOpen={isToolGroupDialogOpen}
        onOpenChange={setIsToolGroupDialogOpen}
        selectedToolGroup={selectedToolGroupForDialog}
        toolGroups={toolGroups}
        providers={providers}
        onEditGroup={handleEditGroup}
        onDeleteGroup={handleDeleteGroup}
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
        onCreate={handleCreateCustomTool}
        isLoading={isSavingCustomTool}
      />

      <CustomToolDialog
        isOpen={isEditCustomToolDialogOpen}
        onOpenChange={handleCloseEditCustomToolDialog}
        providers={providers}
        onClose={handleCloseEditCustomToolDialog}
        onCreate={handleSaveCustomTool}
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
