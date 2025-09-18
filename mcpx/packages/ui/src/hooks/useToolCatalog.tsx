import { useState, useMemo } from "react";
import { useSocketStore, useAccessControlsStore } from "@/store";
import { useUpdateAppConfig } from "@/data/app-config";
import { useToast } from "@/components/ui/use-toast";
import { useToolsStore } from "@/store/tools";
import { toToolId } from "@/utils";

export function useToolCatalog(toolsList: Array<any> = []) {
  const { systemState, appConfig } = useSocketStore((s) => ({
    systemState: s.systemState,
    appConfig: s.appConfig,
  }));

  const { toolGroups, setToolGroups } = useAccessControlsStore((s) => ({
    toolGroups: s.toolGroups,
    setToolGroups: s.setToolGroups,
  }));

  const { mutateAsync: updateAppConfigAsync } = useUpdateAppConfig();
  const { toast } = useToast();
  const { createCustomTool, updateCustomTool } = useToolsStore((s) => ({
    createCustomTool: s.createCustomTool,
    updateCustomTool: s.updateCustomTool,
  }));

  // State
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [selectedToolGroup, setSelectedToolGroup] = useState<string | null>(
    null,
  );
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(
    new Set(),
  );
  const [isToolGroupDialogOpen, setIsToolGroupDialogOpen] = useState(false);
  const [selectedToolGroupForDialog, setSelectedToolGroupForDialog] =
    useState<any>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isCustomToolFullDialogOpen, setIsCustomToolFullDialogOpen] =
    useState(false);
  const [isEditCustomToolDialogOpen, setIsEditCustomToolDialogOpen] =
    useState(false);
  const [editingToolData, setEditingToolData] = useState<any>(null);
  const [editDialogMode, setEditDialogMode] = useState<
    "edit" | "duplicate" | "customize"
  >("edit");
  const [isSavingCustomTool, setIsSavingCustomTool] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddServerModalOpen, setIsAddServerModalOpen] = useState(false);
  const [isToolDetailsDialogOpen, setIsToolDetailsDialogOpen] = useState(false);
  const [selectedToolForDetails, setSelectedToolForDetails] =
    useState<any>(null);
  const [editingGroup, setEditingGroup] = useState<any>(null);
  const [originalSelectedTools, setOriginalSelectedTools] = useState<
    Set<string>
  >(new Set());
  const [isSavingGroupChanges, setIsSavingGroupChanges] = useState(false);

  // Helper function to compare two sets
  const areSetsEqual = (set1: Set<string>, set2: Set<string>) => {
    if (set1.size !== set2.size) return false;
    for (const item of set1) {
      if (!set2.has(item)) return false;
    }
    return true;
  };

  const providers = useMemo(() => {
    let filteredProviders = systemState?.targetServers_new || [];

    // Filter out providers with connection-failed status
    filteredProviders = filteredProviders.filter(
      (provider) => provider.state?.type !== "connection-failed",
    );

    const customToolsByProvider = toolsList
      .filter((tool) => tool.originalToolId)
      .reduce(
        (acc, tool) => {
          const providerName = tool.serviceName;
          if (!acc[providerName]) {
            acc[providerName] = [];
          }
          acc[providerName].push({
            name: tool.name,
            description:
              typeof tool.description === "string"
                ? tool.description
                : tool.description?.text || "",
            serviceName: tool.serviceName,
            originalToolId: tool.originalToolId,
            originalToolName: tool.originalToolName,
            isCustom: true,
          });
          return acc;
        },
        {} as Record<string, any[]>,
      );

    filteredProviders = filteredProviders.map((provider) => ({
      ...provider,
      originalTools: [
        ...provider.originalTools.map((tool) => ({
          ...tool,
          serviceName: provider.name,
        })),
        ...(customToolsByProvider[provider.name] || []),
      ],
    }));

    // Filter by search term
    if (searchQuery) {
      filteredProviders = filteredProviders
        .map((provider) => ({
          ...provider,
          originalTools: provider.originalTools.filter((tool) =>
            tool.name.toLowerCase().includes(searchQuery.toLowerCase()),
          ),
        }))
        .filter((provider) => provider.originalTools.length > 0);
    }

    return filteredProviders;
  }, [
    systemState?.targetServers_new,
    searchQuery,
    toolsList,
    selectedToolGroup,
    toolGroups,
  ]);

  // Calculate total filtered tools for display
  const totalFilteredTools = useMemo(() => {
    return providers.reduce(
      (total, provider) => total + provider.originalTools.length,
      0,
    );
  }, [providers]);

  // Transform tool groups data for display
  const transformedToolGroups = useMemo(() => {
    if (!toolGroups || toolGroups.length === 0) {
      return [];
    }

    const icons = ["⚙️"];

    let groups = toolGroups.map((group, index) => {
      const tools = Object.entries(group.services || {}).map(
        ([serviceName, toolNames]) => ({
          name: serviceName,
          provider: serviceName,
          count: Array.isArray(toolNames) ? toolNames.length : 0,
        }),
      );

      return {
        id: group.id,
        name: group.name,
        description: "Open new pull request",
        icon: icons[index % icons.length],
        tools: tools,
      };
    });

    if (searchQuery) {
      groups = groups.filter(
        (group) =>
          group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          group.tools.some((tool) =>
            tool.name.toLowerCase().includes(searchQuery.toLowerCase()),
          ),
      );
    }

    return groups;
  }, [toolGroups, searchQuery]);

  // Handlers
  const handleToolSelectionChange = (
    toolName: string,
    providerName: string,
    isSelected: boolean,
  ) => {
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

    if (toolGroups.some((group) => group.name === newGroupName.trim())) {
      toast({
        title: "Error",
        description:
          "A tool group with this name already exists. Please choose a different name.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);

    try {
      const toolsByProvider = new Map<string, string[]>();

      selectedTools.forEach((toolKey) => {
        const [providerName, toolName] = toolKey.split(":");
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

      setToolGroups((prev) => [...prev, newToolGroup]);
      await new Promise((resolve) => setTimeout(resolve, 0));

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
              },
            ],
          };

          await updateAppConfigAsync(updatedAppConfig);

          toast({
            title: "Success",
            description: `Tool group "${newGroupName.trim()}" created successfully!`,
          });
        }
      } catch (error) {
        toast({
          title: "Error",
          description:
            "Tool group created but failed to save. Please try again.",
          variant: "destructive",
        });
      }

      setNewGroupName("");
      setShowCreateModal(false);
      setSelectedTools(new Set());
      setIsEditMode(false);
    } catch (error) {
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

  const handleGroupNavigation = (direction: "left" | "right") => {
    const maxIndex = Math.max(
      0,
      Math.ceil(transformedToolGroups.length / 8) - 1,
    );
    if (direction === "left") {
      setCurrentGroupIndex(Math.max(0, currentGroupIndex - 1));
    } else {
      setCurrentGroupIndex(Math.min(maxIndex, currentGroupIndex + 1));
    }
  };

  const handleGroupClick = (groupId: string) => {
    const toolGroup = transformedToolGroups.find(
      (group) => group.id === groupId,
    );
    if (toolGroup) {
      // Find the original group data with services
      const originalGroup = toolGroups.find((group) => group.id === groupId);
      setSelectedToolGroupForDialog(originalGroup || toolGroup);
      setIsToolGroupDialogOpen(true);
    }
  };

  const handleProviderClick = (providerName: string) => {
    const newExpanded = new Set(expandedProviders);
    if (newExpanded.has(providerName)) {
      newExpanded.delete(providerName);
    } else {
      newExpanded.add(providerName);
    }
    setExpandedProviders(newExpanded);
  };

  const handleEditGroup = (group: any) => {
    // Close the tool group sheet
    setSelectedToolGroupForDialog(null);
    setIsToolGroupDialogOpen(false);

    // Set up edit mode
    setEditingGroup(group);
    setIsEditMode(true);

    // Pre-select tools that are currently in the group
    const toolsToSelect = new Set<string>();
    const providersToExpand = new Set<string>();

    // Handle both data structures - services object and tools array
    if (group.services) {
      // Old format: services object
      Object.entries(group.services).forEach(
        ([providerName, toolNames]: [string, any]) => {
          if (toolNames && toolNames.length > 0) {
            providersToExpand.add(providerName);
            toolNames.forEach((toolName: string) => {
              const toolKey = `${providerName}:${toolName}`;
              toolsToSelect.add(toolKey);
            });
          }
        },
      );
    } else if (group.tools && Array.isArray(group.tools)) {
      // New format: tools array
      group.tools.forEach((tool: any) => {
        if (tool.provider && tool.name) {
          const toolKey = `${tool.provider}:${tool.name}`;
          toolsToSelect.add(toolKey);
          providersToExpand.add(tool.provider);
        }
      });
    }
    setSelectedTools(toolsToSelect);
    setOriginalSelectedTools(new Set(toolsToSelect));
    setExpandedProviders(providersToExpand);
  };

  const handleDeleteGroup = async (group: any) => {
    if (
      !confirm(
        `Are you sure you want to delete the tool group "${group.name}"?`,
      )
    ) {
      return;
    }

    try {
      const updatedGroups = toolGroups.filter((g) => g.id !== group.id);
      setToolGroups(updatedGroups);

      // Update app config
      const currentAppConfig = appConfig;
      if (currentAppConfig) {
        const updatedAppConfig = {
          ...currentAppConfig,
          toolGroups: updatedGroups.map((g) => ({
            name: g.name,
            services: g.services,
          })),
        };

        await updateAppConfigAsync(updatedAppConfig);

        toast({
          title: "Success",
          description: `Tool group "${group.name}" deleted successfully!`,
        });
      }

      // Close the sheet
      setSelectedToolGroupForDialog(null);
      setIsToolGroupDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete tool group. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSaveGroupChanges = async () => {
    if (!editingGroup || isSavingGroupChanges) return;

    setIsSavingGroupChanges(true);
    try {
      // Convert selected tools to group format
      const toolsByProvider = new Map<string, string[]>();
      selectedTools.forEach((toolKey) => {
        const [providerName, toolName] = toolKey.split(":");
        if (providerName && toolName) {
          if (!toolsByProvider.has(providerName)) {
            toolsByProvider.set(providerName, []);
          }
          toolsByProvider.get(providerName)!.push(toolName);
        }
      });

      // Update the group
      const updatedGroup = {
        ...editingGroup,
        services: Object.fromEntries(toolsByProvider),
      };

      const updatedGroups = toolGroups.map((g) =>
        g.id === editingGroup.id ? updatedGroup : g,
      );
      setToolGroups(updatedGroups);

      // Update app config
      const currentAppConfig = appConfig;
      if (currentAppConfig) {
        const updatedAppConfig = {
          ...currentAppConfig,
          toolGroups: updatedGroups.map((g) => ({
            name: g.name,
            services: g.services,
          })),
        };

        await updateAppConfigAsync(updatedAppConfig);

        toast({
          title: "Success",
          description: `Tool group "${editingGroup.name}" updated successfully!`,
        });
      }

      // Reset edit state
      setEditingGroup(null);
      setIsEditMode(false);
      setSelectedTools(new Set());
      setOriginalSelectedTools(new Set());
      setExpandedProviders(new Set());
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save changes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingGroupChanges(false);
    }
  };

  const handleCancelGroupEdit = () => {
    setEditingGroup(null);
    setIsEditMode(false);
    setSelectedTools(new Set());
    setOriginalSelectedTools(new Set());
    setExpandedProviders(new Set());
  };

  const handleCreateCustomTool = async (toolData: {
    server: string;
    tool: string;
    name: string;
    description: string;
    parameters: Array<{ name: string; description: string; value: string }>;
  }) => {
    setIsSavingCustomTool(true);
    try {
      const provider = providers.find((p) => p.name === toolData.server);
      const originalTool = provider?.originalTools.find(
        (t: any) => t.name === toolData.tool,
      );

      if (!originalTool) {
        toast({
          title: "Error",
          description: "Original tool not found",
          variant: "destructive",
        });
        return;
      }

      const customTool = {
        name: toolData.name,
        description: {
          action: "rewrite" as const,
          text: toolData.description,
        },
        originalTool: {
          id: toToolId(toolData.server, toolData.tool),
          name: toolData.tool,
          serviceName: toolData.server,
          description: originalTool.description || "",
          inputSchema: originalTool.inputSchema,
        },
        overrideParams: toolData.parameters.reduce(
          (acc, param) => {
            if (param.value) {
              acc[param.name] = { value: param.value };
            }
            return acc;
          },
          {} as Record<string, { value: string }>,
        ),
      };

      const appConfigPayload = createCustomTool(customTool);

      await updateAppConfigAsync(appConfigPayload);

      toast({
        title: "Success",
        description: "Custom tool created successfully",
      });

      setIsCustomToolFullDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create custom tool",
        variant: "destructive",
      });
    } finally {
      setIsSavingCustomTool(false);
    }
  };

  const handleEditCustomTool = (toolData: any) => {
    const originalToolName =
      toolData.originalTool?.name || toolData.originalToolName;

    const editData = {
      server: toolData.serviceName || toolData.server,
      tool: originalToolName,
      name: toolData.name,
      originalName: toolData.name,
      description: toolData.description?.text || toolData.description || "",
      parameters: toolData.overrideParams
        ? Object.entries(toolData.overrideParams).map(
            ([name, param]: [string, any]) => ({
              name,
              description: param.description || "",
              value: param.value || "",
            }),
          )
        : [],
    };
    setEditingToolData(editData);
    setEditDialogMode("edit");
    setIsEditCustomToolDialogOpen(true);
  };

  const handleSaveCustomTool = async (toolData: {
    server: string;
    tool: string;
    name: string;
    originalName?: string;
    description: string;
    parameters: Array<{ name: string; description: string; value: string }>;
  }) => {
    if (isSavingCustomTool) return;

    setIsSavingCustomTool(true);
    try {
      const provider = providers.find((p) => p.name === toolData.server);
      const originalTool = provider?.originalTools.find(
        (t: any) => t.name === toolData.tool,
      );

      if (!originalTool) {
        toast({
          title: "Error",
          description: "Original tool not found",
          variant: "destructive",
        });
        setIsSavingCustomTool(false);
        return;
      }

      // Check if a tool with the same name already exists (custom or original)
      if (editDialogMode !== "edit") {
        const serverProvider = providers.find(
          (p) => p.name === toolData.server,
        );
        if (serverProvider) {
          const originalToolExists = serverProvider.originalTools.some(
            (tool: any) => tool.name === toolData.name,
          );

          if (originalToolExists) {
            toast({
              title: "Error",
              description: `A tool named "${toolData.name}" already exists as an original tool in this server. Please choose a different name.`,
              variant: "destructive",
            });
            setIsSavingCustomTool(false);
            return;
          }
        }

        const existingCustomTools =
          appConfig?.toolExtensions?.services?.[toolData.server] || {};
        let duplicateCustomTool = null;

        for (const [originalToolName, toolExtensions] of Object.entries(
          existingCustomTools,
        )) {
          const childTools = toolExtensions.childTools || [];
          const found = childTools.find(
            (tool: any) => tool.name === toolData.name,
          );
          if (found) {
            duplicateCustomTool = found;
            break;
          }
        }

        if (duplicateCustomTool) {
          toast({
            title: "Error",
            description: `A custom tool named "${toolData.name}" already exists for this server. Please choose a different name.`,
            variant: "destructive",
          });
          setIsSavingCustomTool(false);
          return;
        }
      }

      const customTool = {
        name: toolData.name,
        originalName: toolData.originalName,
        description: {
          action: "rewrite" as const,
          text: toolData.description,
        },
        originalTool: {
          id: toToolId(toolData.server, toolData.tool),
          name: toolData.tool,
          serviceName: toolData.server,
          description: originalTool.description || "",
          inputSchema: originalTool.inputSchema,
        },
        overrideParams: toolData.parameters.reduce(
          (acc, param) => {
            if (param.value) {
              acc[param.name] = { value: param.value };
            }
            return acc;
          },
          {} as Record<string, { value: string }>,
        ),
      };

      // Use updateCustomTool for edit mode, createCustomTool for duplicate/customize
      let appConfigPayload;
      if (editDialogMode === "edit") {
        appConfigPayload = updateCustomTool(customTool);
      } else {
        appConfigPayload = createCustomTool(customTool);
      }

      await updateAppConfigAsync(appConfigPayload);

      const successMessage =
        editDialogMode === "edit"
          ? "Custom tool updated successfully"
          : editDialogMode === "duplicate"
            ? "Custom tool duplicated successfully"
            : "Custom tool created successfully";

      toast({
        title: "Success",
        description: successMessage,
      });

      setIsEditCustomToolDialogOpen(false);
      setEditingToolData(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save custom tool",
        variant: "destructive",
      });
    } finally {
      setIsSavingCustomTool(false);
    }
  };

  const handleDuplicateCustomTool = (toolData: any) => {
    // Get the original tool to extract all parameters
    const provider = providers.find(
      (p) => p.name === (toolData.serviceName || toolData.server),
    );
    const originalToolName =
      toolData.originalTool?.name || toolData.originalToolName;
    const originalTool = provider?.originalTools.find(
      (t: any) => t.name === originalToolName,
    );

    // Combine original tool parameters with override parameters
    const allParameters: Array<{
      name: string;
      description: string;
      value: string;
    }> = [];

    // Add original tool parameters
    if (originalTool?.inputSchema?.properties) {
      Object.entries(originalTool.inputSchema.properties).forEach(
        ([name, param]: [string, any]) => {
          allParameters.push({
            name,
            description: param.description || "",
            value: param.default || "",
          });
        },
      );
    }

    // Override with custom tool parameters if they exist
    if (toolData.overrideParams) {
      Object.entries(toolData.overrideParams).forEach(
        ([name, param]: [string, any]) => {
          const existingParamIndex = allParameters.findIndex(
            (p) => p.name === name,
          );
          if (existingParamIndex >= 0) {
            // Update existing parameter
            allParameters[existingParamIndex] = {
              name,
              description:
                param.description ||
                allParameters[existingParamIndex].description,
              value: param.value || "",
            };
          } else {
            // Add new parameter
            allParameters.push({
              name,
              description: param.description || "",
              value: param.value || "",
            });
          }
        },
      );
    }

    // Generate a unique name for the duplicate
    const baseName = toolData.name;
    let duplicateName = `${baseName} (Copy)`;
    let counter = 1;

    // Check if the name already exists anywhere in this server and increment counter if needed
    const existingCustomTools =
      appConfig?.toolExtensions?.services?.[
        toolData.serviceName || toolData.server
      ] || {};

    while (true) {
      let nameExists = false;

      // Check all original tools in this server for name conflicts
      for (const [originalToolName, toolExtensions] of Object.entries(
        existingCustomTools,
      )) {
        const childTools = toolExtensions.childTools || [];
        if (childTools.some((tool: any) => tool.name === duplicateName)) {
          nameExists = true;
          break;
        }
      }

      if (!nameExists) break;

      counter++;
      duplicateName = `${baseName} (Copy ${counter})`;
    }

    const duplicateData = {
      server: toolData.serviceName || toolData.server,
      tool: originalToolName,
      name: duplicateName,
      description: toolData.description?.text || toolData.description || "",
      parameters: allParameters,
    };

    setEditingToolData(duplicateData);
    setEditDialogMode("duplicate");
    setIsEditCustomToolDialogOpen(true);
  };

  const handleCustomizeToolDialog = (toolData: any) => {
    // Generate a unique name for the customize
    const baseName = `Custom ${toolData.name}`;
    let customizeName = baseName;
    let counter = 1;

    // Check if the name already exists anywhere in this server and increment counter if needed
    const existingCustomTools =
      appConfig?.toolExtensions?.services?.[
        toolData.serviceName || toolData.server
      ] || {};

    while (true) {
      let nameExists = false;

      // Check all original tools in this server for name conflicts
      for (const [, toolExtensions] of Object.entries(existingCustomTools)) {
        const childTools = toolExtensions.childTools || [];
        if (childTools.some((tool: any) => tool.name === customizeName)) {
          nameExists = true;
          break;
        }
      }

      if (!nameExists) break;

      counter++;
      customizeName = `${baseName} ${counter}`;
    }

    const customizeData = {
      server: toolData.serviceName || toolData.server,
      tool: toolData.name,
      name: customizeName,
      description: toolData.description || "",
      parameters: toolData.inputSchema?.properties
        ? Object.entries(toolData.inputSchema.properties).map(
            ([name, param]: [string, any]) => ({
              name,
              description: param.description || "",
              value: param.default || "",
            }),
          )
        : [],
    };
    setEditingToolData(customizeData);
    setEditDialogMode("customize");
    setIsEditCustomToolDialogOpen(true);
  };

  return {
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
  };
}
