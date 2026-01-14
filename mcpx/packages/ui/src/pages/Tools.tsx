import { AddServerModal } from "@/components/dashboard/AddServerModal";
import { CustomToolModal } from "@/components/tools/CustomToolModal";
import { ToolDetailsModal } from "@/components/tools/ToolDetailsModal";
import {
  CustomTool,
  initToolsStore,
  toolsStore,
  useModalsStore,
  useToolsStore,
} from "@/store";
import { ToolsItem } from "@/types";
import { toToolId } from "@/utils";
import sortBy from "lodash/sortBy";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import NewToolCatalog from "./NewToolCatalog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { Banner } from "@/components/ui/banner";
import { apiClient } from "@/lib/api";
import type {
  ToolExtension,
  ToolExtensionParamsRecord,
} from "@mcpx/shared-model";

export default function Tools() {
  const [searchFilter] = useState("");
  const [isToolGroupEditMode, setIsToolGroupEditMode] = useState(false);
  const [handleCancelGroupEdit, setHandleCancelGroupEdit] = useState<
    (() => void) | null
  >(null);
  const [_isToolSelectionOpen, setIsToolSelectionOpen] = useState(false);
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
    closeToolDetailsModal,
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

  const { customTools, tools } = useToolsStore((s) => ({
    customTools: s.customTools,
    tools: s.tools,
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
      ({ description, name, originalTool, overrideParams }) => ({
        description: description ?? {
          text: "",
          action: "append" as const,
        },
        name,
        originalToolId: originalTool.id,
        originalToolName: originalTool.name,
        serviceName: originalTool.serviceName,
        overrideParams,
        inputSchema: originalTool.inputSchema,
      }),
    );

    // Return custom tools first, then original tools, both sorted
    return sortBy(
      [...customToolsList, ...originalTools],
      ["name", "serviceName", "originalToolName"],
    );
  }, [customTools, tools]);

  const handleCreateClick = (_tool: ToolsItem) => {
    setIsToolSelectionOpen(true);
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
      isClosable: true,
      duration: 1000000, // prevent toast disappear
      variant: "warning", // added new variant
      action: (
        <Button
          variant="danger" // added new variant
          onClick={async () => {
            // Dismiss the toast first
            if (toastRef.current && toastRef.current.dismiss) {
              toastRef.current.dismiss();
              toastRef.current = null;
            }

            try {
              const originalToolName = customTool.originalTool.name;
              const customToolName = customTool.name;

              // Delete from backend via API
              await apiClient.deleteToolExtension(
                customTool.originalTool.serviceName,
                originalToolName,
                customToolName,
              );

              // Remove from local state only after successful deletion
              toolsStore.setState((state) => ({
                customTools: state.customTools.filter(
                  (t) =>
                    !(
                      t.originalTool.id === customTool.originalTool.id &&
                      t.name === customTool.name
                    ),
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
  };

  const handleSubmitTool = async (tool: CustomTool, isNew: boolean) => {
    try {
      const processedOverrideParams = Object.fromEntries(
        Object.entries(tool.overrideParams)
          .map(([key, param]) => {
            if (!param || typeof param !== "object") return null;

            // Check if param has a non-empty value or description
            const hasValue =
              param.value !== undefined &&
              param.value !== null &&
              param.value !== "";
            const hasDescription = param.description?.text?.trim() !== "";

            if (!hasValue && !hasDescription) return null;

            const processedParam: ToolExtensionParamsRecord[string] = {};
            if (hasValue) {
              processedParam.value = param.value;
            }
            if (hasDescription) {
              processedParam.description = param.description;
            }

            return [key, processedParam] as const;
          })
          .filter(
            (
              entry,
            ): entry is readonly [string, ToolExtensionParamsRecord[string]] =>
              entry !== null,
          ),
      );

      const toolExtension: ToolExtension = {
        name: tool.name,
        description: tool.description,
        overrideParams: processedOverrideParams,
      };

      if (isNew) {
        // Create new tool extension via API
        await apiClient.createToolExtension(
          tool.originalTool.serviceName,
          tool.originalTool.name,
          toolExtension,
        );
      } else {
        // Update existing tool extension via API
        // For edit mode, use originalName if available (when name is being changed)
        const originalToolName = tool.originalTool.name;
        const customToolName = tool.originalName || tool.name;

        await apiClient.updateToolExtension(
          tool.originalTool.serviceName,
          originalToolName,
          customToolName,
          {
            description: toolExtension.description,
            overrideParams: toolExtension.overrideParams,
          },
        );
      }

      closeCustomToolModal();
    } catch (error) {
      console.error("Failed to save custom tool:", error);
      toast({
        title: "Error",
        description: "Failed to save tool. Please try again.",
        variant: "destructive",
      });
    }
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

  const handleToolGroupEditModeChange = useCallback(
    (isEdit: boolean, cancelHandler: () => void) => {
      setIsToolGroupEditMode(isEdit);
      setHandleCancelGroupEdit(() => cancelHandler);
    },
    [],
  );

  return (
    <div className="w-full bg-[var(--color-bg-app)] relative">
      <div ref={bannerContainerRef} />
      {isToolGroupEditMode && handleCancelGroupEdit && (
        <div
          className="fixed top-0 z-50 right-0"
          style={{
            left: "var(--sidebar-width, 14.75rem)",
          }}
        >
          <Banner
            description={
              <>
                Choose the <span className="italic font-semibold">Tools</span>{" "}
                you want to add to this{" "}
                <span className="italic font-semibold">Tool-Group</span>
              </>
            }
          />
        </div>
      )}
      {/* New Tool Catalog Component */}
      <NewToolCatalog
        searchFilter={searchFilter}
        toolsList={toolsList}
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
      {isToolDetailsModalOpen && toolDetails && (
        <ToolDetailsModal
          onClose={() => closeToolDetailsModal()}
          onCustomize={handleDetailsModalCustomizeClick}
          tool={toolDetails}
        />
      )}
      {isAddServerModalOpen && <AddServerModal onClose={closeAddServerModal} />}
    </div>
  );
}
