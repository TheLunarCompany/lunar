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
} from "@/store";
import { ToolDetails, ToolsItem } from "@/types";
import { inputSchemaToParamsList, toToolId } from "@/utils";
import sortBy from "lodash/sortBy";
import { useEffect, useMemo, useState, useRef } from "react";
import NewToolCatalog from "./NewToolCatalog";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";

export default function Tools() {
  const { mutateAsync: updateAppConfigAsync } = useUpdateAppConfig();

  const [searchFilter, setSearchFilter] = useState("");
  const [showOnlyCustomTools, setShowOnlyCustomTools] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

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

  useEffect(() => initToolsStore, []);

  const toolsList: Array<ToolsItem> = useMemo(() => {
    return sortBy(
      tools
        .map(
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
        )
        .concat(
          customTools.map(
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
            }),
          ),
        ),
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
    const originalTool = tools.find(
      (t) => t.name === tool.name && t.serviceName === tool.serviceName,
    );

    if (!originalTool) {
      console.warn(
        `Original tool with name "${tool.name}" and service "${tool.serviceName}" not found.`,
      );
      return;
    }

    const newCustomTool: CustomTool = {
      description: tool.description,
      name: "",
      originalTool: {
        description: originalTool.description || "",
        id: originalTool.id,
        name: originalTool.name,
        serviceName: originalTool.serviceName,
        inputSchema: originalTool.inputSchema,
      },
      overrideParams: tool.overrideParams || {},
    };

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
    if (window.confirm("Are you sure you want to remove this tool?")) {
      const appConfigPayload = deleteCustomTool(customTool);
      await updateAppConfigAsync(appConfigPayload);
    }
  };

  const handleSubmitTool = async (tool: CustomTool, isNew: boolean) => {
    const appConfigPayload = isNew
      ? createCustomTool(tool)
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

  return (
    <div className="w-full bg-[var(--color-bg-app)] relative">
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
