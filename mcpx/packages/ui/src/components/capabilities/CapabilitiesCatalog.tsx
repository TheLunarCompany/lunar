import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import type { ToolExtensionParamsRecord } from "@mcpx/shared-model";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  createCustomCapabilityTool,
  deleteCustomCapabilityTool,
  updateCustomCapabilityTool,
} from "./capability-actions";
import { buildCapabilitySelectionKey } from "./capability-selection-key";
import { CapabilityGroupSheet } from "./CapabilityGroupSheet";
import { CapabilityGroupsSection } from "./CapabilityGroupsSection";
import { CapabilityItemDetailsDialog } from "./CapabilityItemDetailsDialog";
import { CapabilityProvidersSection } from "./CapabilityProvidersSection";
import { CapabilitySelectionPanel } from "./CapabilitySelectionPanel";
import { CreateCapabilityGroupModal } from "./CreateCapabilityGroupModal";
import {
  CustomCapabilityToolDialog,
  type CustomCapabilityToolSubmitPayload,
} from "./CustomCapabilityToolDialog";
import { EditCapabilityGroupModal } from "./EditCapabilityGroupModal";
import { useCapabilitiesCatalog } from "./useCapabilitiesCatalog";
import type { CapabilityGroup, CapabilityItem } from "./types";

function buildOverrideParams(
  parameters: CustomCapabilityToolSubmitPayload["parameters"],
): ToolExtensionParamsRecord {
  return parameters.reduce<ToolExtensionParamsRecord>(
    (overrideParams, parameter) => {
      const value = parameter.value.trim();
      const description = parameter.description.trim();
      if (!value && !description) {
        return overrideParams;
      }

      const override: ToolExtensionParamsRecord[string] = {};
      if (value) {
        override.value = value;
      }
      if (description) {
        override.description = { action: "rewrite", text: description };
      }

      overrideParams[parameter.name] = override;
      return overrideParams;
    },
    {},
  );
}

function buildCustomToolParameters(item: CapabilityItem) {
  const properties = item.inputSchema?.properties;
  if (!properties || typeof properties !== "object") {
    return [];
  }

  return Object.entries(properties).map(([name, schema]) => {
    const record =
      typeof schema === "object" && schema !== null
        ? (schema as Record<string, unknown>)
        : {};
    const override = item.overrideParams?.[name];

    return {
      name,
      value:
        override?.value === undefined || override.value === null
          ? record.default === undefined || record.default === null
            ? ""
            : String(record.default)
          : String(override.value),
      description:
        override?.description?.text ??
        (typeof record.description === "string" ? record.description : ""),
    };
  });
}

export function CapabilitiesCatalog() {
  const catalog = useCapabilitiesCatalog();
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isAddCustomToolMode, setIsAddCustomToolMode] = useState(false);
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [editingMetadataGroup, setEditingMetadataGroup] =
    useState<CapabilityGroup | null>(null);
  const [sheetGroup, setSheetGroup] = useState<CapabilityGroup | null>(null);
  const [detailsItem, setDetailsItem] = useState<CapabilityItem | null>(null);
  const [customDialogItem, setCustomDialogItem] =
    useState<CapabilityItem | null>(null);
  const [isSavingCustomTool, setIsSavingCustomTool] = useState(false);

  const selectedCustomItem = useMemo(() => {
    const selectedKey = Array.from(catalog.selectedCapabilityKeys)[0];
    if (!selectedKey) return null;
    return catalog.providers
      .flatMap((provider) => provider.items)
      .find(
        (item) =>
          buildCapabilitySelectionKey(item.providerName, item.name) ===
          selectedKey,
      );
  }, [catalog.providers, catalog.selectedCapabilityKeys]);

  function clearSelectionMode() {
    setIsSelectionMode(false);
    setIsAddCustomToolMode(false);
    catalog.setSelectedCapabilityKeys(new Set());
    catalog.clearProviderExpansion();
  }

  function handleCreateToolGroupClick() {
    if (isSelectionMode && !isAddCustomToolMode) {
      clearSelectionMode();
      return;
    }

    catalog.startCreatingGroup();
    catalog.dismissToasts();
    catalog.expandProviderSections();
    catalog.selectGroup(null);
    setSheetGroup(null);
    setIsSelectionMode(true);
    setIsAddCustomToolMode(false);
  }

  function handleAddCustomToolClick() {
    if (isAddCustomToolMode) {
      clearSelectionMode();
      return;
    }

    catalog.dismissToasts();
    catalog.setSelectedCapabilityKeys(new Set());
    catalog.expandProviderSections();
    catalog.selectGroup(null);
    setSheetGroup(null);
    setIsSelectionMode(true);
    setIsAddCustomToolMode(true);
  }

  async function handleCreateGroup(draft: {
    name: string;
    description: string;
  }) {
    const created = await catalog.createGroup(draft);
    if (created) {
      setIsCreateGroupModalOpen(false);
      clearSelectionMode();
    }
    return created;
  }

  async function handleUpdateGroupMetadata(draft: {
    name: string;
    description: string;
  }) {
    const updated = await catalog.updateEditingGroup(draft);
    if (updated) {
      setEditingMetadataGroup(null);
      clearSelectionMode();
    }
    return updated;
  }

  async function handleSubmitCustomTool(
    payload: CustomCapabilityToolSubmitPayload,
  ) {
    try {
      setIsSavingCustomTool(true);
      const overrideParams = buildOverrideParams(payload.parameters);

      if (payload.originalCustomCapabilityName) {
        await updateCustomCapabilityTool({
          providerName: payload.providerName,
          baseCapabilityName: payload.baseCapabilityName,
          customCapabilityName: payload.originalCustomCapabilityName,
          updates: {
            description: {
              action: "rewrite",
              text: payload.description,
            },
            overrideParams,
          },
        });
      } else {
        await createCustomCapabilityTool({
          providerName: payload.providerName,
          baseCapabilityName: payload.baseCapabilityName,
          customCapabilityTool: {
            name: payload.customCapabilityName,
            description: {
              action: "rewrite",
              text: payload.description,
            },
            overrideParams,
          },
        });
      }

      setCustomDialogItem(null);
      clearSelectionMode();
      return true;
    } catch (error) {
      toast({
        title: "Failed to save custom tool",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsSavingCustomTool(false);
    }
  }

  async function handleDeleteCustomItem(item: CapabilityItem) {
    if (!item.originalToolName) return;

    try {
      await deleteCustomCapabilityTool({
        providerName: item.providerName,
        baseCapabilityName: item.originalToolName,
        customCapabilityName: item.name,
      });
    } catch (error) {
      toast({
        title: "Failed to delete custom tool",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  }

  function handleUpdateGroupItems(group: CapabilityGroup) {
    catalog.startEditingGroup(group.name);
    catalog.expandProviderSections();
    setIsSelectionMode(true);
    setIsAddCustomToolMode(false);
    setSheetGroup(null);
  }

  function handleEditGroup(group: CapabilityGroup) {
    catalog.startEditingGroup(group.name);
    setEditingMetadataGroup(group);
    setSheetGroup(null);
  }

  return (
    <>
      {(catalog.isCreatingGroup ||
        catalog.isUpdatingGroup ||
        catalog.isDeletingGroup) && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center bg-white/80 backdrop-blur-xs">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="size-12 animate-spin text-primary" />
            <p className="text-lg font-medium text-[var(--colors-gray-700)]">
              Processing...
            </p>
          </div>
        </div>
      )}

      {isAddCustomToolMode && (
        <div className="px-6 pt-6">
          <Banner description="Add custom tool. Select 1 tool to customize" />
        </div>
      )}

      {isSelectionMode && !isAddCustomToolMode && (
        <div className="px-6 pt-6">
          <Banner
            description={
              <>
                Choose the <span className="font-semibold italic">Tools</span>{" "}
                you want to add to this{" "}
                <span className="font-semibold italic">Tool-Group</span>
              </>
            }
          />
        </div>
      )}

      <div className="w-full bg-gray-10 p-6">
        <div className="container mx-auto">
          <div className="mb-6 flex items-center justify-between gap-4">
            <p className="text-xl font-semibold text-[var(--colors-indigo-950)]">
              Tools
            </p>
            <div className="flex gap-3">
              {!isSelectionMode || isAddCustomToolMode ? (
                <Button
                  onClick={handleAddCustomToolClick}
                  variant={isAddCustomToolMode ? "default" : "outline"}
                  className="border-2 border-primary px-4 py-2 text-sm font-medium"
                >
                  {isAddCustomToolMode ? "Cancel" : "Add Custom Tool"}
                </Button>
              ) : null}
              {!isAddCustomToolMode && (
                <Button onClick={handleCreateToolGroupClick}>
                  {isSelectionMode ? "Cancel" : "Create Tool Group"}
                </Button>
              )}
            </div>
          </div>

          <CapabilityGroupsSection
            groups={catalog.groups}
            selectedGroupName={catalog.selectedGroupName}
            onCreateGroupClick={handleCreateToolGroupClick}
            onGroupClick={(group) => {
              catalog.selectGroup(group.name);
              setSheetGroup(group);
            }}
            onEditGroup={handleEditGroup}
            onUpdateGroupItems={handleUpdateGroupItems}
            onDeleteGroup={(group) => void catalog.deleteGroup(group.name)}
          />

          <CapabilityProvidersSection
            providers={catalog.visibleProviders}
            groups={catalog.groups}
            selectedGroupName={catalog.selectedGroupName}
            expandedProviders={catalog.expandedProviders}
            isSelectionMode={isSelectionMode}
            isAddCustomToolMode={isAddCustomToolMode}
            selectedCapabilityKeys={catalog.selectedCapabilityKeys}
            searchQuery={catalog.searchQuery}
            onSearchQueryChange={catalog.setSearchQuery}
            annotationFilter={catalog.annotationFilter}
            onAnnotationFilterChange={catalog.setAnnotationFilter}
            onProviderClick={catalog.toggleProviderExpansion}
            onShowAllTools={() => catalog.selectGroup(null)}
            onCapabilitySelectionChange={(item, providerName, selected) =>
              catalog.toggleCapabilitySelection(
                buildCapabilitySelectionKey(providerName, item.name),
                selected,
              )
            }
            onShowItemDetails={setDetailsItem}
            onCustomizeItem={(item) => setCustomDialogItem(item)}
            onEditItem={(item) => setCustomDialogItem(item)}
            onDeleteItem={(item) => void handleDeleteCustomItem(item)}
          />

          <CapabilitySelectionPanel
            selectedCapabilityKeys={catalog.selectedCapabilityKeys}
            editingGroup={catalog.editingGroup}
            isAddCustomToolMode={isAddCustomToolMode}
            isSaving={catalog.isUpdatingGroup}
            onSaveGroupChanges={() => {
              void (async () => {
                const updated = await catalog.updateEditingGroup({
                  name: catalog.editingGroup?.name ?? "",
                  description: catalog.editingGroup?.description ?? "",
                });
                if (updated) {
                  clearSelectionMode();
                }
              })();
            }}
            onClearSelection={() =>
              catalog.setSelectedCapabilityKeys(new Set())
            }
            onCreateGroup={() => setIsCreateGroupModalOpen(true)}
            onCustomizeSelectedItem={() => {
              if (selectedCustomItem) {
                setCustomDialogItem(selectedCustomItem);
              }
            }}
          />
        </div>
      </div>

      <CreateCapabilityGroupModal
        isOpen={isCreateGroupModalOpen}
        onClose={() => setIsCreateGroupModalOpen(false)}
        selectedItemCount={catalog.selectedCapabilityKeys.size}
        error={catalog.createGroupError}
        isCreating={catalog.isCreatingGroup}
        onSubmitCapabilityGroup={handleCreateGroup}
      />

      <EditCapabilityGroupModal
        isOpen={!!editingMetadataGroup}
        group={editingMetadataGroup}
        onClose={() => setEditingMetadataGroup(null)}
        error={catalog.editGroupError}
        isSaving={catalog.isUpdatingGroup}
        onSubmitCapabilityGroup={handleUpdateGroupMetadata}
      />

      <CapabilityGroupSheet
        isOpen={!!sheetGroup}
        group={sheetGroup}
        providers={catalog.providers}
        onOpenChange={(open) => !open && setSheetGroup(null)}
        onShowItemDetails={setDetailsItem}
        onEditGroup={handleEditGroup}
        onUpdateGroupItems={handleUpdateGroupItems}
        onDeleteGroup={(group) => void catalog.deleteGroup(group.name)}
      />

      <CapabilityItemDetailsDialog
        isOpen={!!detailsItem}
        item={detailsItem}
        onClose={() => setDetailsItem(null)}
        onCustomizeItem={(item) => {
          setDetailsItem(null);
          setCustomDialogItem(item);
        }}
        onEditItem={(item) => {
          setDetailsItem(null);
          setCustomDialogItem(item);
        }}
        onDeleteItem={(item) => {
          setDetailsItem(null);
          void handleDeleteCustomItem(item);
        }}
      />

      <CustomCapabilityToolDialog
        isOpen={!!customDialogItem}
        onOpenChange={(open) => !open && setCustomDialogItem(null)}
        onClose={() => setCustomDialogItem(null)}
        providers={catalog.providers}
        preSelectedProviderName={customDialogItem?.providerName}
        preSelectedItemName={
          customDialogItem?.isCustom
            ? customDialogItem.originalToolName
            : customDialogItem?.name
        }
        preFilledData={
          customDialogItem?.isCustom
            ? {
                name: customDialogItem.name,
                description: customDialogItem.description,
                parameters: buildCustomToolParameters(customDialogItem),
              }
            : undefined
        }
        isLoading={isSavingCustomTool}
        onSubmitCustomCapabilityTool={handleSubmitCustomTool}
      />
    </>
  );
}
