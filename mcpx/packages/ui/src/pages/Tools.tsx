import { AddServerModal } from "@/components/dashboard/AddServerModal";
import { CustomToolModal } from "@/components/tools/CustomToolModal";
import { ToolDetailsModal } from "@/components/tools/ToolDetailsModal";
import { ToolSelector } from "@/components/tools/ToolSelector";
import { useUpdateAppConfig } from "@/data/app-config";
import {
  CustomTool,
  initToolsStore,
  useModalsStore,
  useToolsStore,
  toolsStore,
  socketStore,
} from "@/store";
import { ToolDetails, ToolsItem } from "@/types";
import { inputSchemaToParamsList, toToolId } from "@/utils";
import sortBy from "lodash/sortBy";
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import NewToolCatalog from "./NewToolCatalog";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { Banner } from "@/components/ui/banner";

export default function Tools() {
  const { mutateAsync: updateAppConfigAsync } = useUpdateAppConfig();

  const [searchFilter, setSearchFilter] = useState("");
  const [showOnlyCustomTools, setShowOnlyCustomTools] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isToolGroupEditMode, setIsToolGroupEditMode] = useState(false);
  const [handleCancelGroupEdit, setHandleCancelGroupEdit] = useState<(() => void) | null>(null);
  const [isToolSelectionOpen, setIsToolSelectionOpen] = useState(false);
  const bannerContainerRef = useRef<HTMLDivElement>(null);

  // Track toast reference for dismissing when editing/duplicating
  const toastRef = useRef<ReturnType<typeof toast> | null>(null);

  const {
    isCustomToolModalOpen,
    selectedTool,
    openCustomToolModal,
    closeCustomToolModal,
    isToolDetailsModalOpen,
    toolDetails,
    openToolDetailsModal,
    closeToolDetailsModal,
    openAddServerModal,
    isAddServerModalOpen,
    closeAddServerModal,
  } = useModalsStore((s) => ({
    isCustomToolModalOpen: s.isCustomToolModalOpen,
    selectedTool: s.selectedTool,
    openCustomToolModal: s.openCustomToolModal,
    closeCustomToolModal: s.closeCustomToolModal,
    isToolDetailsModalOpen: s.isToolDetailsModalOpen,
    toolDetails: s.toolDetails,
    openToolDetailsModal: s.openToolDetailsModal,
    closeToolDetailsModal: s.closeToolDetailsModal,
    openAddServerModal: s.openAddServerModal,
    isAddServerModalOpen: s.isAddServerModalOpen,
    closeAddServerModal: s.closeAddServerModal,
  }));

  const {
    createCustomTool,
    customTools,
    deleteCustomTool,
    tools,
    updateCustomTool,
  } = useToolsStore((s) => ({
    createCustomTool: s.createCustomTool,
    customTools: s.customTools,
    deleteCustomTool: s.deleteCustomTool,
    tools: s.tools,
    updateCustomTool: s.updateCustomTool,
  }));

  // Initialize tools store on mount
  useEffect(() => {
    initToolsStore();
  }, []);

  const toolsList: Array<ToolsItem> = useMemo(() => {
    const originalTools = tools.map(
      ({ description, name, serviceName }): ToolsItem => ({
        description: {
          text: description || "",
          action: "rewrite" as const,
        },
        name,
        originalToolId: "",
        originalToolName: "",
        serviceName,
        overrideParams: {},
      }),
    );

    const customToolsList = customTools.map(
      ({ description, name, originalTool, overrideParams, parameterDescriptions }) => ({
        description: description ?? {
          text: "",
          action: "append" as const,
        },
        name,
        originalToolId: originalTool.id,
        originalToolName: originalTool.name,
        serviceName: originalTool.serviceName,
        overrideParams,
        parameterDescriptions,
      }),
    );

    // Return custom tools first, then original tools, both sorted
    return sortBy(
      [...customToolsList, ...originalTools],
      ["name", "serviceName", "originalToolName"],
    );
  }, [customTools, tools]);

  const handleDetailsClick = (tool: ToolsItem) => {
    let toolDetails: ToolDetails | undefined;
    if (tool.originalToolId) {
      const customTool = customTools.find(
        (t) =>
          t.originalTool.id === tool.originalToolId && t.name === tool.name,
      );
      if (!customTool) {
        console.warn(`Custom tool with ID ${tool.originalToolId} not found.`);
        return;
      }

      toolDetails = {
        description: customTool.description?.text
          ? customTool.description.action === "append"
            ? customTool.originalTool.description +
              "\n" +
              customTool.description.text
            : customTool.description.text
          : customTool.originalTool.description || "",
        name: customTool.name,
        originalToolName: customTool.originalTool.name,
        params: inputSchemaToParamsList(customTool.originalTool.inputSchema),
        overrideParams: customTool.overrideParams,
        serviceName: customTool.originalTool.serviceName,
      };
    } else {
      const serverTool = tools.find(
        (t) => t.serviceName === tool.serviceName && t.name === tool.name,
      );
      if (!serverTool) {
        console.warn(
          `Server tool with ID "${toToolId(tool.serviceName, tool.name)}" not found.`,
        );
        return;
      }

      toolDetails = {
        description: serverTool.description || "",
        name: serverTool.name,
        params: inputSchemaToParamsList(serverTool.inputSchema),
        serviceName: serverTool.serviceName,
      };
    }

    if (!toolDetails) {
      console.warn(`Tool details for "${tool.name}" not found.`);
      return;
    }

    openToolDetailsModal(toolDetails);
  };

  const handleCreateClick = (tool: ToolsItem) => {
    setIsToolSelectionOpen(true);
  };

  const handleCustomToolSelection = (selectedTool: ToolsItem) => {
    const originalTool = tools.find(
      (t) => t.name === selectedTool.name && t.serviceName === selectedTool.serviceName,
    );

    if (!originalTool) {
      console.warn(
        `Original tool with name "${selectedTool.name}" and service "${selectedTool.serviceName}" not found.`,
      );
      return;
    }

    const newCustomTool: CustomTool = {
      description: selectedTool.description,
      name: "",
      originalTool: {
        description: originalTool.description || "",
        id: originalTool.id,
        name: originalTool.name,
        serviceName: originalTool.serviceName,
        inputSchema: originalTool.inputSchema,
      },
      overrideParams: selectedTool.overrideParams || {},
    };

    setIsToolSelectionOpen(false);
    openCustomToolModal(newCustomTool);
  };

  const handleEditClick = (tool: ToolsItem) => {
    const customTool = customTools.find(
      (t) => t.originalTool.id === tool.originalToolId && t.name === tool.name,
    );

    if (!customTool) {
      console.warn(`Custom tool with ID ${tool.originalToolId} not found.`);
      return;
    }

    // Dismiss any existing toast notifications when editing
    // This prevents the edge case where delete toast remains visible while editing
    if (toastRef.current && toastRef.current.dismiss) {
      toastRef.current.dismiss();
      toastRef.current = null;
    }

    // Pass the existing custom tool for editing
    openCustomToolModal(customTool);
  };

  const handleDuplicateClick = (tool: ToolsItem) => {
    const customTool = customTools.find(
      (t) => t.originalTool.id === tool.originalToolId && t.name === tool.name,
    );

    if (!customTool) {
      console.warn(`Custom tool with ID ${tool.originalToolId} not found.`);
      return;
    }

    // Dismiss any existing toast notifications when duplicating
    // This prevents the edge case where delete toast remains visible while duplicating
    if (toastRef.current && toastRef.current.dismiss) {
      toastRef.current.dismiss();
      toastRef.current = null;
    }

    // Create a duplicate with "Copy" suffix but keep it editable
    openCustomToolModal({
      ...customTool,
      name: "",
    });
  };

  const handleDeleteTool = async (tool: ToolsItem) => {
    const customTool = customTools.find(
      (t) => t.originalTool.id === tool.originalToolId && t.name === tool.name,
    );


    if (!customTool) {
      console.warn(`Custom tool with ID ${tool.originalToolId} not found.`);
      return;
    }

    
    toastRef.current = toast({
      title: "Delete Custom Tool",
      description: (
        <>
          Are you sure you want to delete <strong>{customTool.name}</strong>?
        </>
      ),
isClosable:true,
      duration : 1000000, // prevent toast disappear
      variant:"warning", // added new variant
      action: (
        <Button variant="danger" // added new variant
          onClick={async() => {
            // Dismiss the toast first
            if (toastRef.current && toastRef.current.dismiss) {
              toastRef.current.dismiss();
              toastRef.current = null;
            }
            
            try {
              // Check if appConfig is available before deleting
              const socketState = socketStore.getState();
              if (!socketState.appConfig) {
                toast({
                  title: "Error",
                  description: "Unable to delete. Please try again in a moment.",
                  variant: "warning",
                });
                return;
              }
              
              // Delete from backend first, then update local state
              const appConfigPayload = await deleteCustomTool(customTool);
              await updateAppConfigAsync(appConfigPayload);
              
              // Remove from local state only after successful deletion
              toolsStore.setState((state) => ({
                customTools: state.customTools.filter(
                  (t) => !(t.originalTool.id === customTool.originalTool.id && t.name === customTool.name)
                ),
              }));
            } catch (error) {
              console.error("Failed to delete custom tool:", error);
              toast({
                title: "Error",
                description: "Failed to delete tool. Please try again.",
                variant: "destructive",
              });
            }
          }}
        >
          Ok
        </Button>
      ),
      position: "bottom-left",
    });



    // if (window.confirm("Are you sure you want to remove this tool?")) {
    //   const appConfigPayload = deleteCustomTool(customTool);
    //   await updateAppConfigAsync(appConfigPayload);
    // }
  };

  const handleSubmitTool = async (tool: CustomTool, isNew: boolean) => {
    const appConfigPayload = isNew
      ? await createCustomTool(tool)
      : updateCustomTool(tool);

    await updateAppConfigAsync(appConfigPayload);

    closeCustomToolModal();
  };

  const handleDetailsModalCustomizeClick = () => {
    if (!toolDetails) {
      console.warn("Tool details are not available for customization.");
      return;
    }

    if (toolDetails.originalToolName) {
      const customTool = customTools.find(
        (t) =>
          t.name === toolDetails.name &&
          t.originalTool.serviceName === toolDetails.serviceName,
      );

      if (!customTool) {
        console.warn(
          `Custom tool with name "${toolDetails.name}" and service "${toolDetails.serviceName}" not found.`,
        );
        return;
      }

      closeToolDetailsModal();
      openCustomToolModal(customTool);

      return;
    }

    const originalTool = tools.find(
      (t) =>
        t.name === toolDetails.name &&
        t.serviceName === toolDetails.serviceName,
    );

    if (!originalTool) {
      console.warn(
        `Original tool with name "${toolDetails.name}" and service "${toolDetails.serviceName}" not found.`,
      );
      return;
    }

    const newCustomTool: CustomTool = {
      description: {
        action: "rewrite" as const,
        text: originalTool.description || "",
      },
      name: "",
      originalTool: {
        description: originalTool.description || "",
        id: toToolId(originalTool.serviceName, originalTool.name),
        name: originalTool.name,
        serviceName: originalTool.serviceName,
        inputSchema: originalTool?.inputSchema,
      },
      overrideParams: {},
    };

    closeToolDetailsModal();
    openCustomToolModal(newCustomTool);
  };

  const handleEditModeToggle = () => {
    setIsEditMode(!isEditMode);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
  };

  const handleToolGroupEditModeChange = useCallback((isEdit: boolean, cancelHandler: () => void) => {
    setIsToolGroupEditMode(isEdit);
    setHandleCancelGroupEdit(() => cancelHandler);
  }, []);

  return (
    <div className="w-full bg-[var(--color-bg-app)] relative">
      <div ref={bannerContainerRef} />
      {isToolGroupEditMode && handleCancelGroupEdit && (
        <div className="sticky top-[72px] z-50">
          <Banner
            title="Create New Tool Group"
            description="Create New Tool Group Mode - Select severs to add to the new tool group"
            variant="info"
            onClose={handleCancelGroupEdit}
          />
        </div>
      )}
      {/* New Tool Catalog Component */}
      <NewToolCatalog
        searchFilter={searchFilter}
        showOnlyCustomTools={showOnlyCustomTools}
        toolsList={toolsList}
        isEditMode={isEditMode}
        onEditModeToggle={handleEditModeToggle}
        onCancelEdit={handleCancelEdit}
        handleEditClick={handleEditClick}
        handleDuplicateClick={handleDuplicateClick}
        handleDeleteTool={handleDeleteTool}
        handleCustomizeTool={handleCreateClick}
        dismissDeleteToast={() => {
          if (toastRef.current && toastRef.current.dismiss) {
            toastRef.current.dismiss();
            toastRef.current = null;
          }
        }}
        onToolGroupEditModeChange={handleToolGroupEditModeChange}
      />
      {isCustomToolModalOpen && selectedTool && (
        <CustomToolModal
          handleSubmitTool={handleSubmitTool}
          validateUniqueToolName={(name, serviceName) =>
            !toolsList.some(
              (t) => t.name === name && t.serviceName === serviceName,
            )
          }
          onClose={() => closeCustomToolModal()}
          tool={selectedTool}
        />
      )}
      {isToolSelectionOpen && (
        <ToolSelectionModal
          tools={tools}
          onSelect={handleCustomToolSelection}
          onClose={() => setIsToolSelectionOpen(false)}
        />
      )}
      {isToolDetailsModalOpen && toolDetails && (
        <ToolDetailsModal
          onClose={() => closeToolDetailsModal()}
          onCustomize={handleDetailsModalCustomizeClick}
          tool={toolDetails}
        />
      )}
      {isAddServerModalOpen && (
        <AddServerModal
          onClose={closeAddServerModal}
        />
      )}
    </div>
  );
}

const buttonStyles = {
  createNewToolGroup: {
    backgroundColor: "#9333ea",
    color: "white",
    padding: "8px 16px",
    borderRadius: "8px",
    fontWeight: "500",
    fontSize: "14px",
    border: "none",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  createNewToolGroupHover: {
    backgroundColor: "#7c3aed",
  },
  cancel: {
    border: "1px solid #d1d5db",
    color: "#374151",
    padding: "8px 16px",
    borderRadius: "8px",
    fontWeight: "500",
    fontSize: "14px",
    backgroundColor: "transparent",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  cancelHover: {
    backgroundColor: "#f9fafb",
  },
} as const;
