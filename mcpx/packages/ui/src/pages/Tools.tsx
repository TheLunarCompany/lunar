import { AddServerModal } from "@/components/dashboard/AddServerModal";
import { CustomToolModal } from "@/components/tools/CustomToolModal";
import { ToolDetailsModal } from "@/components/tools/ToolDetailsModal";
import { ToolsTable } from "@/components/tools/ToolsTable";
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
import { useEffect, useMemo } from "react";
import * as YAML from "yaml";

export default function Tools() {
  const { mutateAsync: updateAppConfigAsync } = useUpdateAppConfig();

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

  // Reset the state when the page unmounts
  useEffect(() => initToolsStore, []);

  const toolsList: Array<ToolsItem> = useMemo(() => {
    return sortBy(
      tools
        .map(({ description, name, serviceName }) => ({
          description: {
            text: description || "",
            action: "rewrite" as const,
          },
          name,
          originalToolId: "",
          originalToolName: "",
          serviceName,
          overrideParams: {},
        }))
        .concat(
          customTools.map(
            ({ description, name, originalTool, overrideParams }) => ({
              description: (description as any) || {
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

    openCustomToolModal({
      description: tool.description,
      name: tool.name,
      originalTool: {
        description: customTool.originalTool.description || "",
        id: customTool.originalTool.id,
        name: customTool.originalTool.name,
        serviceName: customTool.originalTool.serviceName,
        inputSchema: customTool.originalTool.inputSchema,
      },
      overrideParams: tool.overrideParams || {},
    });
  };

  const handleDuplicateClick = (tool: ToolsItem) => {
    const customTool = customTools.find(
      (t) => t.originalTool.id === tool.originalToolId && t.name === tool.name,
    );

    if (!customTool) {
      console.warn(`Custom tool with ID ${tool.originalToolId} not found.`);
      return;
    }

    openCustomToolModal({
      description: tool.description,
      name: "",
      originalTool: {
        description: customTool.originalTool.description || "",
        id: customTool.originalTool.id,
        name: customTool.originalTool.name,
        serviceName: customTool.originalTool.serviceName,
        inputSchema: customTool.originalTool.inputSchema,
      },
      overrideParams: tool.overrideParams || {},
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
      const newAppConfig = {
        yaml: YAML.stringify(appConfigPayload),
      };
      await updateAppConfigAsync(newAppConfig);
    }
  };

  const handleSubmitTool = async (tool: CustomTool, isNew: boolean) => {
    const appConfigPayload = isNew
      ? createCustomTool(tool)
      : updateCustomTool(tool);

    const newAppConfig = {
      yaml: YAML.stringify(appConfigPayload),
    };

    await updateAppConfigAsync(newAppConfig);

    closeCustomToolModal();
  };

  return (
    <div className="min-h-screen w-full bg-[var(--color-bg-app)] relative">
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-start gap-12 whitespace-nowrap">
          <h1 className="text-3xl font-bold mb-8 tracking-tight">Tools</h1>
        </div>
        <ToolsTable
          data={toolsList}
          handleAddServerClick={openAddServerModal}
          handleCreateClick={handleCreateClick}
          handleDeleteTool={handleDeleteTool}
          handleDetailsClick={handleDetailsClick}
          handleDuplicateClick={handleDuplicateClick}
          handleEditClick={handleEditClick}
        />
      </div>
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
          tool={toolDetails}
        />
      )}
      {isAddServerModalOpen && (
        <AddServerModal
          isOpen={isAddServerModalOpen}
          onClose={closeAddServerModal}
          onServerAdded={() => {
            closeAddServerModal();
          }}
        />
      )}
    </div>
  );
}
