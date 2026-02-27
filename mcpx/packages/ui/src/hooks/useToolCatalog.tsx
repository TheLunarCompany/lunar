import React, { useEffect, useMemo, useState } from "react";
import { validateToolGroupName } from "@/components/tools/ToolGroupSheet";
import { socketStore, useAccessControlsStore, useSocketStore } from "@/store";
import { accessControlsStore } from "@/store/access-controls";
import { useToast } from "@/components/ui/use-toast";
import { toToolId } from "@/utils";
import { TargetServer } from "@mcpx/shared-model";
import z from "zod";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import type {
  ToolExtension,
  ConsumerConfig,
  Permissions,
  ToolExtensionParamsRecord,
  ToolExtensionsService,
} from "@mcpx/shared-model";
import type { ToolGroup, AgentProfile } from "@/store/access-controls";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ToolsItem } from "@/types";
import type { ToolSelectionItem } from "@/components/tools/ProviderCard";
import type { ToolCardTool } from "@/components/tools/ToolCard";

const ITEMS_PER_PAGE = 8;

// Type for tool items in the catalog (from providers)
// This is a flexible type that can represent both SDK Tool items and custom tool items
interface CatalogToolItem {
  name: string;
  description?: string;
  inputSchema: Tool["inputSchema"];
  serviceName?: string;
  originalToolId?: string;
  originalToolName?: string;
  overrideParams?: ToolExtensionParamsRecord;
  isCustom?: boolean;
}

// Type for tool data being edited in the dialog
interface EditingToolData {
  server: string;
  tool: string;
  name: string;
  originalName?: string;
  description: string;
  parameters: Array<{ name: string; description: string; value: string }>;
}

// Type for JSON schema property
interface JsonSchemaProperty {
  description?: string;
  default?: string;
}

// Validate tool group object using the schema
const validateToolGroupObject = (toolGroup: ToolGroup) => {
  try {
    // Create schema for single tool group (toolGroupSchema is an array schema)
    const singleToolGroupSchema = z.object({
      name: z
        .string()
        .regex(
          /^[a-zA-Z0-9_\s-]{1,64}$/,
          "Tool group name must contain only letters, digits, spaces, underscores, and dashes (1-64 characters)",
        ),
      services: z.record(
        z.string(),
        z.union([z.array(z.string()), z.literal("*")]),
      ),
    });
    singleToolGroupSchema.parse(toolGroup);
    return { isValid: true };
  } catch (error: unknown) {
    const zodError = error as { errors?: Array<{ message?: string }> };
    return {
      isValid: false,
      error:
        zodError.errors?.[0]?.message || "Invalid tool group configuration",
    };
  }
};

// Clean up references to a deleted tool group from permissions config
const cleanToolGroupReferences = (
  permissions: Permissions,
  deletedGroupName: string,
): Permissions => {
  const cleanedPermissions = { ...permissions };

  const filterF = (groupName: string) => groupName !== deletedGroupName;
  const cleanConsumerConfig = (consumer: ConsumerConfig): ConsumerConfig => {
    if ("allow" in consumer) {
      consumer._type = "default-block";
    } else {
      consumer._type = "default-allow";
    }
    switch (consumer._type) {
      case "default-block": {
        return { ...consumer, allow: consumer.allow.filter(filterF) };
      }
      case "default-allow": {
        return { ...consumer, block: consumer.block.filter(filterF) };
      }
    }
  };
  return {
    default: cleanConsumerConfig(cleanedPermissions.default),
    consumers: Object.fromEntries(
      Object.entries(cleanedPermissions.consumers).map(([key, consumer]) => [
        key,
        cleanConsumerConfig(consumer),
      ]),
    ),
  };
};

// Remove tool group references from permissions (trusting types - no validation)
// Efficiently fetches all permissions at once, cleans them, and updates only what changed
const removeToolGroupFromPermissions = async (
  deletedName: string,
  toolGroupId: string,
  profiles: AgentProfile[],
) => {
  try {
    // Fetch all permissions at once
    const permissions = await apiClient.getPermissions();

    // Clean all permissions using the typed function
    const cleanedPermissions = cleanToolGroupReferences(
      permissions,
      deletedName,
    );

    // Check if default permission changed
    const defaultChanged =
      JSON.stringify(permissions.default) !==
      JSON.stringify(cleanedPermissions.default);
    if (defaultChanged) {
      await apiClient.updateDefaultPermission(cleanedPermissions.default);
    }

    // Find profiles that reference this tool group (by ID) to determine affected consumers
    const affectedProfiles = profiles.filter(
      (profile) =>
        profile.name !== "default" && profile.toolGroups?.includes(toolGroupId),
    );

    // Get all consumer tags from affected profiles
    const consumerTags = new Set<string>();
    affectedProfiles.forEach((profile) => {
      profile.agents?.forEach((agent: string) => {
        if (agent) consumerTags.add(agent);
      });
    });

    // Only update consumers that are affected by this tool group deletion
    // Compare before/after to only update if changed
    await Promise.all(
      Array.from(consumerTags).map(async (consumerTag) => {
        const originalConsumer = permissions.consumers[consumerTag];
        const cleanedConsumer = cleanedPermissions.consumers[consumerTag];

        // Only update if consumer exists and changed
        if (originalConsumer && cleanedConsumer) {
          const changed =
            JSON.stringify(originalConsumer) !==
            JSON.stringify(cleanedConsumer);
          if (changed) {
            await apiClient.updatePermissionConsumer(
              consumerTag,
              cleanedConsumer,
            );
          }
        }
      }),
    );
  } catch (error) {
    // If getPermissions fails, fall back to individual updates for backwards compatibility
    console.warn(
      "Failed to fetch all permissions, falling back to individual updates:",
      error,
    );

    // Update default permission
    try {
      const defaultPermission = await apiClient.getDefaultPermission();
      const cleanedPermissions = cleanToolGroupReferences(
        { default: defaultPermission, consumers: {} },
        deletedName,
      );
      if (
        JSON.stringify(defaultPermission) !==
        JSON.stringify(cleanedPermissions.default)
      ) {
        await apiClient.updateDefaultPermission(cleanedPermissions.default);
      }
    } catch {
      // Default permission might not exist - that's fine
    }

    // Find affected consumers and update individually
    const affectedProfiles = profiles.filter(
      (profile) =>
        profile.name !== "default" && profile.toolGroups?.includes(toolGroupId),
    );

    if (affectedProfiles.length > 0) {
      const consumerTags = new Set<string>();
      affectedProfiles.forEach((profile) => {
        profile.agents?.forEach((agent: string) => {
          if (agent) consumerTags.add(agent);
        });
      });

      await Promise.all(
        Array.from(consumerTags).map(async (consumerTag) => {
          try {
            const consumerConfig =
              await apiClient.getPermissionConsumer(consumerTag);
            const cleanedPermissions = cleanToolGroupReferences(
              { default: consumerConfig, consumers: {} },
              deletedName,
            );
            if (
              JSON.stringify(consumerConfig) !==
              JSON.stringify(cleanedPermissions.default)
            ) {
              await apiClient.updatePermissionConsumer(
                consumerTag,
                cleanedPermissions.default,
              );
            }
          } catch {
            // Consumer doesn't exist - that's fine
          }
        }),
      );
    }
  }
};

export function useToolCatalog(toolsList: ToolsItem[] = []) {
  const { systemState, appConfig } = useSocketStore((s) => ({
    systemState: s.systemState,
    appConfig: s.appConfig,
  }));

  const { toolGroups, setToolGroups, hasPendingChanges, profiles } =
    useAccessControlsStore((s) => ({
      toolGroups: s.toolGroups,
      setToolGroups: s.setToolGroups,
      hasPendingChanges: s.hasPendingChanges,
      profiles: s.profiles || [],
    }));

  const { toast, dismiss } = useToast();

  // State
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [createGroupError, setCreateGroupError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [editingGroupName, setEditingGroupName] = useState("");
  const [editingGroupDescription, setEditingGroupDescription] = useState("");
  const [editingGroupOriginalName, setEditingGroupOriginalName] = useState("");
  const [editGroupError, setEditGroupError] = useState<string | null>(null);
  const [isSavingGroupName, setIsSavingGroupName] = useState(false);
  const [toolGroupOperation, _setToolGroupOperation] = useState<
    "creating" | "editing" | "deleting" | null
  >(null);
  const [customToolOperation, setCustomToolOperation] = useState<
    "creating" | "editing" | "deleting" | null
  >(null);
  const [recentlyCreatedGroupIds, _setRecentlyCreatedGroupIds] = useState<
    Set<string>
  >(new Set());
  const [recentlyModifiedProviders, _setRecentlyModifiedProviders] = useState<
    Set<string>
  >(new Set());
  const [recentlyModifiedGroupIds, _setRecentlyModifiedGroupIds] = useState<
    Set<string>
  >(new Set());
  const [cleanupTimeouts, _setCleanupTimeouts] = useState<
    Map<string, ReturnType<typeof setTimeout>>
  >(new Map());
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [selectedToolGroup, setSelectedToolGroup] = useState<string | null>(
    null,
  );
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(
    new Set(),
  );

  // Synchronize tool groups with app config to remove orphaned groups
  // Skip sync when creating/editing groups or when there are pending changes
  useEffect(() => {
    // Don't sync if we're currently creating or there are pending changes
    if (isCreating || hasPendingChanges) {
      return;
    }

    if (appConfig?.toolGroups) {
      const configGroups = appConfig.toolGroups;
      const localGroups = toolGroups;

      const configGroupNames = new Set(configGroups.map((g) => g.name));

      // Find tool groups in UI that don't exist in config and aren't recently created or modified
      const orphanedGroups = localGroups.filter(
        (g) =>
          !configGroupNames.has(g.name) &&
          !recentlyCreatedGroupIds.has(g.id) &&
          !recentlyModifiedGroupIds.has(g.id),
      );

      if (orphanedGroups.length > 0) {
        const synchronizedGroups = localGroups.filter(
          (g) =>
            configGroupNames.has(g.name) ||
            recentlyCreatedGroupIds.has(g.id) ||
            recentlyModifiedGroupIds.has(g.id),
        );
        setToolGroups(synchronizedGroups);
      }
    }
  }, [
    appConfig?.toolGroups,
    toolGroups,
    recentlyCreatedGroupIds,
    recentlyModifiedGroupIds,
    isCreating,
    hasPendingChanges,
    setToolGroups,
  ]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      cleanupTimeouts.forEach((timeout) => clearTimeout(timeout));
    };
  }, [cleanupTimeouts]);

  const [isToolGroupDialogOpen, setIsToolGroupDialogOpen] = useState(false);
  const [selectedToolGroupForDialog, setSelectedToolGroupForDialog] =
    useState<ToolGroup | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isCustomToolFullDialogOpen, setIsCustomToolFullDialogOpen] =
    useState(false);
  const [isAddCustomToolMode, setIsAddCustomToolMode] = useState(false);
  const [selectedCustomToolKey, setSelectedCustomToolKey] = useState<
    string | null
  >(null);
  const [isEditCustomToolDialogOpen, setIsEditCustomToolDialogOpen] =
    useState(false);
  const [editingToolData, setEditingToolData] =
    useState<EditingToolData | null>(null);
  const [editDialogMode, setEditDialogMode] = useState<
    "edit" | "duplicate" | "customize"
  >("edit");
  const [isSavingCustomTool, setIsSavingCustomTool] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddServerModalOpen, setIsAddServerModalOpen] = useState(false);
  const [isToolDetailsDialogOpen, setIsToolDetailsDialogOpen] = useState(false);
  const [selectedToolForDetails, setSelectedToolForDetails] =
    useState<ToolCardTool | null>(null);
  const [editingGroup, setEditingGroup] = useState<ToolGroup | null>(null);
  const [originalSelectedTools, setOriginalSelectedTools] = useState<
    Set<string>
  >(new Set());
  const [isSavingGroupChanges, setIsSavingGroupChanges] = useState(false);

  // Cleanup toasts when component unmounts
  React.useEffect(() => {
    return () => {
      // Dismiss all toasts when component unmounts
      dismiss();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dismiss intentionally excluded to avoid loops
  }, []);

  // Dismiss edit mode toast when exiting edit mode
  React.useEffect(() => {
    if (!isEditMode) {
      // Use setTimeout to avoid immediate re-render issues
      setTimeout(() => dismiss(), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dismiss intentionally excluded to avoid loops
  }, [isEditMode]); // Remove dismiss from dependencies to avoid loops

  // Helper function to compare two sets
  const areSetsEqual = (set1: Set<string>, set2: Set<string>) => {
    if (set1.size !== set2.size) return false;
    for (const item of set1) {
      if (!set2.has(item)) return false;
    }
    return true;
  };

  // Memoize custom tools grouped by provider - only recompute when toolsList changes
  const customToolsByProvider = useMemo(() => {
    return toolsList
      .filter((tool) => tool.originalToolId)
      .reduce(
        (acc, tool) => {
          const providerName = tool.serviceName;
          if (providerName && !acc[providerName]) {
            acc[providerName] = [];
          }
          if (providerName && tool.inputSchema) {
            acc[providerName].push({
              name: tool.name,
              description:
                typeof tool.description === "string"
                  ? tool.description
                  : tool.description?.text || "",
              serviceName: tool.serviceName,
              originalToolId: tool.originalToolId,
              originalToolName: tool.originalToolName,
              overrideParams: tool.overrideParams,
              inputSchema: tool.inputSchema,
              isCustom: true,
            });
          }
          return acc;
        },
        {} as Record<string, CatalogToolItem[]>,
      );
  }, [toolsList]);

  const recentlyModifiedProvidersArray = useMemo(() => {
    return Array.from(recentlyModifiedProviders);
  }, [recentlyModifiedProviders]);

  const customToolNamesByServer = useMemo(() => {
    const namesByServer = new Map<string, Set<string>>();
    if (!appConfig?.toolExtensions?.services) {
      return namesByServer;
    }

    for (const [serverName, serverTools] of Object.entries(
      appConfig.toolExtensions.services,
    )) {
      const customToolNames = new Set<string>();
      for (const toolExtensions of Object.values(serverTools)) {
        for (const childTool of toolExtensions.childTools || []) {
          customToolNames.add(childTool.name);
        }
      }
      namesByServer.set(serverName, customToolNames);
    }
    return namesByServer;
  }, [appConfig?.toolExtensions?.services]);

  // Memoize base filtered providers (without search) - recompute when servers or custom tools change
  const baseProviders = useMemo(() => {
    let filteredProviders = systemState?.targetServers || [];

    // During brief moments when server state hasn't updated yet,
    // keep providers that were recently modified to prevent flickering
    const serverProviderNames = new Set(filteredProviders.map((p) => p.name));
    const missingProviders = recentlyModifiedProvidersArray
      .filter((providerName) => !serverProviderNames.has(providerName))
      .map(
        (providerName) =>
          ({
            name: providerName,
            originalTools: [],
            state: { type: "connected" as const },
            icon: undefined,
            url: "",
            tools: [],
            usage: [],
            headers: {},
            severity: "info" as const,
          }) as unknown as TargetServer,
      );

    filteredProviders = [...filteredProviders, ...missingProviders];

    // Merge custom tools with provider tools
    // Type assertion needed because we're mixing CatalogToolItem with Tool types
    // NOTE: `filteredProviders` is typed as `TargetServer[]`, but we are adding custom properties to tools
    // which causes pains. Ideally should be reflected in the type system properly.
    filteredProviders = filteredProviders.map((provider) => ({
      ...provider,
      originalTools: [
        ...(customToolsByProvider[provider.name] || []).filter(
          (tool) => tool?.name,
        ),
        ...provider.originalTools
          .filter((tool) => tool?.name) // Filter out tools without names
          .map((tool) => ({
            ...tool,
            serviceName: provider.name,
          })),
      ].filter((tool) => tool?.name), // Final filter to ensure no undefined names
    })) as unknown as TargetServer[];

    return filteredProviders;
  }, [
    systemState?.targetServers,
    customToolsByProvider,
    recentlyModifiedProvidersArray,
  ]);

  // Memoize search filter - only apply when searchQuery changes
  const searchFilterLower = useMemo(() => {
    return searchQuery ? searchQuery.toLowerCase() : null;
  }, [searchQuery]);

  // Final providers with search filtering - recompute only when baseProviders or searchQuery changes
  const providers = useMemo(() => {
    if (!searchFilterLower) {
      return baseProviders;
    }

    return baseProviders
      .map((provider) => ({
        ...provider,
        originalTools: provider.originalTools.filter((tool) =>
          tool.name.toLowerCase().includes(searchFilterLower),
        ),
      }))
      .filter((provider) => provider.originalTools.length > 0);
  }, [baseProviders, searchFilterLower]);

  // reset add custom tool selection when data changes
  useEffect(() => {
    setSelectedCustomToolKey(null);
    setSelectedTools(new Set());
    setIsAddCustomToolMode(false);
  }, [toolsList, searchQuery]);

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

    let groups = toolGroups.map((group) => {
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
        description: group.description || "",
        icon: group.name.substring(0, 2).toUpperCase(),
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
    tool: ToolSelectionItem,
    providerName: string,
    isSelected: boolean,
  ) => {
    const toolKey = `${providerName}:${tool.name ?? ""}`;

    if (isAddCustomToolMode) {
      if (!isSelected) {
        setSelectedTools(new Set());
        setSelectedCustomToolKey(null);
        return;
      }

      setSelectedTools(new Set([toolKey]));
      setSelectedCustomToolKey(toolKey);
      return;
    }

    const newSelection = new Set(selectedTools);
    if (isSelected) {
      newSelection.add(toolKey);
    } else {
      newSelection.delete(toolKey);
    }
    setSelectedTools(newSelection);
  };

  const handleSelectAllTools = (providerName: string) => {
    if (isAddCustomToolMode) {
      return; // Don't allow select all in custom tool mode
    }

    // Find the provider in the providers list
    const provider = providers.find((p) => p.name === providerName);
    if (!provider) {
      return;
    }

    // Get all tools for this provider
    const allToolKeys = provider.originalTools.map(
      (tool) => `${providerName}:${tool.name}`,
    );

    // Check if all tools from this provider are already selected
    const allSelected = allToolKeys.every((toolKey) =>
      selectedTools.has(toolKey),
    );

    // Create a new selection set
    const newSelection = new Set(selectedTools);

    if (allSelected) {
      // If all are selected, deselect all tools from this provider
      allToolKeys.forEach((toolKey) => {
        newSelection.delete(toolKey);
      });
    } else {
      // If not all are selected, select all tools from this provider
      allToolKeys.forEach((toolKey) => {
        newSelection.add(toolKey);
      });
    }

    setSelectedTools(newSelection);
  };

  const handleCreateToolGroup = () => {
    setShowCreateModal(true);
    setIsEditMode(false); // Exit edit mode when opening create modal
    setIsAddCustomToolMode(false);
    setSelectedCustomToolKey(null);
  };

  const handleSaveToolGroup = async () => {
    if (!newGroupName.trim()) {
      setCreateGroupError("Group name cannot be empty");
      return;
    }

    const nameValidation = validateToolGroupName(newGroupName.trim());
    if (!nameValidation.isValid) {
      setCreateGroupError(nameValidation.error || "Invalid tool group name");
      return;
    }

    if (toolGroups.some((group) => group.name === newGroupName.trim())) {
      setCreateGroupError("A tool group with this name already exists.");
      return;
    }

    if (selectedTools.size === 0) {
      setCreateGroupError("Please select at least one tool.");
      return;
    }

    const toolsByProvider = new Map<string, string[]>();
    selectedTools.forEach((toolKey) => {
      const [providerName, toolName] = toolKey.split(":");
      if (!toolsByProvider.has(providerName)) {
        toolsByProvider.set(providerName, []);
      }
      toolsByProvider.get(providerName)?.push(toolName);
    });

    const newToolGroup = {
      id: `tool_group_${toolGroups.length}`,
      name: newGroupName.trim(),
      description: newGroupDescription.trim() || undefined,
      services: Object.fromEntries(toolsByProvider),
      tools: Array.from(toolsByProvider.entries()).flatMap(
        ([providerName, toolNames]) =>
          toolNames.map((toolName) => ({
            provider: providerName,
            name: toolName,
          })),
      ),
    };

    try {
      // Set hasPendingChanges FIRST to prevent sync effect from running
      accessControlsStore.setState({ hasPendingChanges: true });

      // Create tool group via API
      // Note: API ToolGroup doesn't include 'id' (client-side only)
      const toolGroupToCreate: Omit<ToolGroup, "id"> = {
        name: newToolGroup.name,
        services: newToolGroup.services,
        ...(newToolGroup.description && {
          description: newToolGroup.description,
        }),
      };
      await apiClient.createToolGroup(toolGroupToCreate);

      // Update local state immediately - setToolGroups will call setAppConfigUpdates
      const newToolGroups = [...toolGroups, newToolGroup];
      setToolGroups(newToolGroups);

      // Navigate to the page containing the newly created tool group
      // Calculate which page the new group will be on after filtering
      // Calculate transformed groups to find where the new group will appear
      let transformedGroups = newToolGroups.map((group) => {
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
          description: group.description || "",
          icon: group.name.substring(0, 2).toUpperCase(),
          tools: tools,
        };
      });

      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        transformedGroups = transformedGroups.filter(
          (group) =>
            group.name.toLowerCase().includes(searchLower) ||
            group.tools.some((tool) =>
              tool.name.toLowerCase().includes(searchLower),
            ),
        );
      }

      // Find the index of the new group in the filtered list
      const newGroupIndex = transformedGroups.findIndex(
        (g) => g.id === newToolGroup.id,
      );

      // Navigate to the page containing the new group (if it's visible after filtering)
      if (newGroupIndex >= 0) {
        const targetPage = Math.floor(newGroupIndex / ITEMS_PER_PAGE);
        setCurrentGroupIndex(targetPage);
      }

      // Explicitly ensure hasPendingChanges stays true (setAppConfigUpdates might recalculate it)
      accessControlsStore.setState({ hasPendingChanges: true });

      // Wait for socket to send a valid AppConfig update that includes our new group
      // Poll until the appConfig includes our new group or timeout after 5 seconds

      // Wait a bit to ensure UI updates, then close modal and reset
      setTimeout(() => {
        // Close modal and reset state
        setShowCreateModal(false);
        setIsEditMode(false);
        setNewGroupName("");
        setSelectedTools(new Set());
        setOriginalSelectedTools(new Set());
        setExpandedProviders(new Set());

        setTimeout(() => {
          accessControlsStore.setState({ hasPendingChanges: false });
        }, 1000);
      }, 300);
    } catch (error) {
      console.error("Error creating tool group:", error);
      setCreateGroupError("Failed to create tool group. Please try again.");
      accessControlsStore.setState({ hasPendingChanges: false });
    }
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setNewGroupName("");
    setNewGroupDescription("");
    setCreateGroupError(null);
    setIsAddCustomToolMode(false);
    setSelectedCustomToolKey(null);
  };

  const handleNewGroupNameChange = (value: string) => {
    setNewGroupName(value);
    if (createGroupError) {
      setCreateGroupError(null);
    }
  };

  const handleNewGroupDescriptionChange = (value: string) => {
    setNewGroupDescription(value);
  };

  const handleOpenEditGroupModal = (group: ToolGroup) => {
    setEditingGroupName(group.name);
    setEditingGroupDescription(group.description || "");
    setEditingGroupOriginalName(group.name);
    setEditGroupError(null);
    setShowEditGroupModal(true);
  };

  const handleCloseEditGroupModal = () => {
    setShowEditGroupModal(false);
    setEditingGroupName("");
    setEditingGroupDescription("");
    setEditingGroupOriginalName("");
    setEditGroupError(null);
  };

  const handleEditGroupNameChange = (value: string) => {
    setEditingGroupName(value);
    if (editGroupError) {
      setEditGroupError(null);
    }
  };

  const handleEditGroupDescriptionChange = (value: string) => {
    setEditingGroupDescription(value);
  };

  const handleSaveGroupNameChanges = async () => {
    if (!editingGroupName.trim()) {
      setEditGroupError("Group name cannot be empty");
      return;
    }

    const nameValidation = validateToolGroupName(editingGroupName.trim());
    if (!nameValidation.isValid) {
      setEditGroupError(nameValidation.error || "Invalid tool group name");
      return;
    }

    // Check if name changed and if new name already exists
    if (
      editingGroupName.trim() !== editingGroupOriginalName &&
      toolGroups.some((group) => group.name === editingGroupName.trim())
    ) {
      setEditGroupError("A tool group with this name already exists.");
      return;
    }

    setIsSavingGroupName(true);
    setEditGroupError(null);

    try {
      const groupToUpdate = toolGroups.find(
        (g) => g.name === editingGroupOriginalName,
      );
      if (!groupToUpdate) {
        setEditGroupError("Tool group not found");
        setIsSavingGroupName(false);
        return;
      }

      // Set hasPendingChanges FIRST to prevent sync effect from running
      accessControlsStore.setState({ hasPendingChanges: true });

      // Update the tool group via API
      // Note: id is client-side only, not sent to server
      // Create updates object matching what server expects (services + optional description/name)
      const updates: {
        description?: string;
        services: { [serviceName: string]: string[] };
        name?: string;
      } = {
        description: editingGroupDescription.trim() || undefined,
        services: groupToUpdate.services || {},
      };

      // If name changed, include it in updates
      if (editingGroupName.trim() !== editingGroupOriginalName) {
        updates.name = editingGroupName.trim();
      }

      await apiClient.updateToolGroup(
        editingGroupOriginalName,
        updates as Omit<ToolGroup, "name">,
      );

      // Update local state
      const updatedGroups = toolGroups.map((g) => {
        if (g.name === editingGroupOriginalName) {
          return {
            ...g,
            name: editingGroupName.trim(),
            description: editingGroupDescription.trim() || undefined,
          };
        }
        return g;
      });
      setToolGroups(updatedGroups);

      // Update selectedToolGroupForDialog if it's the same group (by ID)
      if (selectedToolGroupForDialog?.id === groupToUpdate.id) {
        setSelectedToolGroupForDialog({
          ...selectedToolGroupForDialog,
          name: editingGroupName.trim(),
          description: editingGroupDescription.trim() || undefined,
        });
      }

      // Update editingGroup if it's the same group (by ID) - this is important for "Update Tools"
      if (editingGroup?.id === groupToUpdate.id) {
        setEditingGroup({
          ...editingGroup,
          name: editingGroupName.trim(),
          description: editingGroupDescription.trim() || undefined,
        });
      }

      accessControlsStore.setState({ hasPendingChanges: true });

      // Close modal after successful save
      setTimeout(() => {
        setIsSavingGroupName(false);
        handleCloseEditGroupModal();
        accessControlsStore.setState({ hasPendingChanges: false });
      }, 300);
    } catch (error) {
      console.error("Error updating tool group:", error);
      setEditGroupError("Failed to update tool group. Please try again.");
      accessControlsStore.setState({ hasPendingChanges: false });
      setIsSavingGroupName(false);
    }
  };

  const handleGroupNavigation = (direction: "left" | "right") => {
    const maxIndex = Math.max(
      0,
      Math.ceil(transformedToolGroups.length / ITEMS_PER_PAGE) - 1,
    );
    if (direction === "left") {
      setCurrentGroupIndex(Math.max(0, currentGroupIndex - 1));
    } else {
      setCurrentGroupIndex(Math.min(maxIndex, currentGroupIndex + 1));
    }
  };

  const handleGroupClick = (groupId: string) => {
    // Find the tool group in the raw toolGroups array (not transformed)
    const originalGroup = toolGroups.find((group) => group.id === groupId);
    if (originalGroup) {
      setSelectedToolGroupForDialog(originalGroup);
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

  const fixToolGroupConfiguration = (group: ToolGroup) => {
    if (!group.services) return group;

    const fixedServices = { ...group.services };
    let hasChanges = false;

    Object.entries(fixedServices).forEach(([providerName, toolNames]) => {
      if (Array.isArray(toolNames)) {
        const provider = providers.find((p) => p.name === providerName);
        const availableTools =
          provider?.originalTools?.map((t) => t.name) || [];

        const fixedToolNames = toolNames.map((toolName: string) => {
          if (availableTools.includes(toolName)) {
            return toolName; // Tool name is valid
          } else {
            // Tool name is invalid, use first available tool as fallback
            hasChanges = true;
            return availableTools.length > 0 ? availableTools[0] : toolName;
          }
        });

        fixedServices[providerName] = fixedToolNames;
      }
    });

    if (hasChanges) {
      // Update the tool group in the store
      const updatedGroup = { ...group, services: fixedServices };
      setToolGroups((prev) =>
        prev.map((g) => (g.id === group.id ? updatedGroup : g)),
      );

      // Update the backend configuration
      const currentAppConfig = appConfig;
      if (currentAppConfig) {
        // Update tool group via API
        const groupToUpdate = toolGroups.find((g) => g.id === group.id);
        if (groupToUpdate) {
          apiClient.updateToolGroup(groupToUpdate.name, {
            services: fixedServices,
          });
        }
      }

      return updatedGroup;
    }

    return group;
  };

  const handleEditGroup = (group: ToolGroup) => {
    const fixedGroup = fixToolGroupConfiguration(group);

    // Close the tool group sheet
    setSelectedToolGroupForDialog(null);
    setIsToolGroupDialogOpen(false);

    // Set up edit mode
    setEditingGroup(fixedGroup);
    setIsEditMode(true);

    // Pre-select tools that are currently in the group
    const toolsToSelect = new Set<string>();
    const providersToExpand = new Set<string>();

    // Handle services object format
    if (group.services) {
      Object.entries(group.services).forEach(([providerName, toolNames]) => {
        if (toolNames && toolNames.length > 0) {
          providersToExpand.add(providerName);
          // Find the provider to get available tools
          const provider = providers.find((p) => p.name === providerName);
          const availableTools =
            provider?.originalTools?.map((t) => t.name) || [];

          toolNames.forEach((toolName: string) => {
            // Check if the configured tool name exists in available tools
            if (availableTools.includes(toolName)) {
              const toolKey = `${providerName}:${toolName}`;
              toolsToSelect.add(toolKey);
            } else {
              // Tool name doesn't exist, use the first available tool as fallback
              if (availableTools.length > 0) {
                const fallbackTool = availableTools[0];
                const toolKey = `${providerName}:${fallbackTool}`;
                toolsToSelect.add(toolKey);
              }
            }
          });
        }
      });
    }

    setSelectedTools(toolsToSelect);
    setOriginalSelectedTools(new Set(toolsToSelect));
    setExpandedProviders(providersToExpand);
  };

  const handleDeleteGroupAction = async (group: ToolGroup) => {
    // Store original state for rollback
    const originalGroups = [...toolGroups];

    try {
      // Set hasPendingChanges FIRST to prevent socket from overwriting
      accessControlsStore.setState({ hasPendingChanges: true });

      // Clean up references to the tool group from permissions BEFORE deleting
      // This is required because the backend validates that referenced tool groups exist
      await removeToolGroupFromPermissions(group.name, group.id, profiles);

      // Delete tool group via API (after permissions are cleaned)
      await apiClient.deleteToolGroup(group.name);

      // Update local state after server confirmation
      const updatedGroups = toolGroups.filter((g) => g.id !== group.id);
      setToolGroups(updatedGroups);
      accessControlsStore.setState({ hasPendingChanges: true });

      // Adjust pagination if current page becomes empty
      const newTotalPages = Math.ceil(updatedGroups.length / ITEMS_PER_PAGE);
      if (newTotalPages > 0 && currentGroupIndex >= newTotalPages) {
        // Current page is now empty, move to the last available page
        setCurrentGroupIndex(Math.max(0, newTotalPages - 1));
      }

      // Wait for socket to confirm the deletion
      // Wait a bit to ensure UI updates
      setTimeout(() => {
        // Close the sheet
        setSelectedToolGroupForDialog(null);
        setIsToolGroupDialogOpen(false);

        setTimeout(() => {
          accessControlsStore.setState({ hasPendingChanges: false });
        }, 1000);
      }, 300);
    } catch (error) {
      // Rollback on error
      console.error(
        "[ToolCatalog] Failed to delete tool group, rolling back",
        error,
      );
      setToolGroups(originalGroups);
      accessControlsStore.setState({ hasPendingChanges: false });
      toast({
        title: "Error",
        description: "Failed to delete tool group. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateGroupDescription = async (
    groupId: string,
    description: string,
  ) => {
    try {
      // Update local state first
      const updatedGroups = toolGroups.map((group) =>
        group.id === groupId ? { ...group, description: description } : group,
      );
      setToolGroups(updatedGroups);

      // Update the selected tool group for dialog if it's the same group
      if (
        selectedToolGroupForDialog &&
        selectedToolGroupForDialog.id === groupId
      ) {
        setSelectedToolGroupForDialog({
          ...selectedToolGroupForDialog,
          description: description,
        });
      }

      // Update backend via API
      const groupToUpdate = updatedGroups.find((g) => g.id === groupId);
      if (groupToUpdate) {
        await apiClient.updateToolGroup(groupToUpdate.name, {
          services: groupToUpdate.services,
        });
      }
    } catch (error) {
      console.error("Error updating tool group description:", error);
      toast({
        title: "Error",
        description: "Failed to update tool group description",
        variant: "destructive",
      });
    }
  };

  const handleDeleteGroup = (group: ToolGroup) => {
    const toastObj = toast({
      title: "Remove Tool Group",
      description: (
        <>
          Are you sure you want to delete the tool group{" "}
          <strong>{group.name}</strong>?
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
            if (toastObj && toastObj.dismiss) {
              toastObj.dismiss();
            }

            // Then handle the deletion
            await handleDeleteGroupAction(group);
          }}
        >
          Ok
        </Button>
      ),
    });
  };

  const handleSaveGroupChanges = async () => {
    if (!editingGroup || isSavingGroupChanges) return;

    // Validate the group name if it was changed
    const nameValidation = validateToolGroupName(editingGroup.name);
    if (!nameValidation.isValid) {
      toast({
        title: "Invalid Name",
        description: nameValidation.error,
        variant: "destructive",
      });
      return;
    }

    setIsSavingGroupChanges(true);

    // Set loading state to show full-page loader
    // Store original state for rollback
    const originalGroups = [...toolGroups];

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

      // Validate the complete tool group object
      const objectValidation = validateToolGroupObject(updatedGroup);
      if (!objectValidation.isValid) {
        toast({
          title: "Invalid Configuration",
          description: objectValidation.error,
          variant: "destructive",
        });
        return;
      }

      // Set hasPendingChanges FIRST to prevent socket from overwriting
      accessControlsStore.setState({ hasPendingChanges: true });

      // Update the tool group (name cannot be changed)
      await apiClient.updateToolGroup(editingGroup.name, {
        services: updatedGroup.services,
      });

      // Update local state after server confirmation
      const updatedGroups = toolGroups.map((g) =>
        g.id === editingGroup.id ? updatedGroup : g,
      );
      setToolGroups(updatedGroups);
      accessControlsStore.setState({ hasPendingChanges: true });

      // Wait for socket to confirm the update
      // Wait a bit to ensure UI updates
      setTimeout(() => {
        setIsSavingGroupChanges(false);

        // Reset edit state
        setEditingGroup(null);
        setIsEditMode(false);
        setSelectedTools(new Set());
        setOriginalSelectedTools(new Set());
        setExpandedProviders(new Set());

        toast({
          title: "Success",
          description: `Tool group "${editingGroup.name}" updated successfully!`,
        });

        setTimeout(() => {
          accessControlsStore.setState({ hasPendingChanges: false });
        }, 1000);
      }, 300);
    } catch (error) {
      // Rollback UI state if server validation fails
      setToolGroups(originalGroups);
      setIsSavingGroupChanges(false);

      // Extract error message from the error object
      let errorMessage = "Failed to save changes. Please try again.";
      if (error && typeof error === "object" && "message" in error) {
        const errorStr = String(error.message);
        if (errorStr.includes("Tool group name must match pattern")) {
          errorMessage =
            "Tool group name can only contain letters, numbers, underscores, and hyphens (1-64 characters)";
        } else if (errorStr.includes("Invalid request format")) {
          errorMessage =
            "Invalid tool group configuration. Please check your input.";
        } else {
          errorMessage = errorStr;
        }
      }

      toast({
        title: "Error",
        description: errorMessage,
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
    setIsAddCustomToolMode(false);
    setSelectedCustomToolKey(null);
  };

  const handleCreateCustomTool = async (toolData: {
    server: string;
    tool: string;
    name: string;
    description: string;
    parameters: Array<{ name: string; description: string; value: string }>;
  }) => {
    // Expand the provider immediately - before any API calls
    // This ensures it stays expanded throughout the entire process, preventing visual jumps
    setExpandedProviders((prev) => {
      const newSet = new Set(prev);
      newSet.add(toolData.server);
      return newSet;
    });

    setCustomToolOperation("creating");

    try {
      const provider = providers.find((p) => p.name === toolData.server);
      const originalTool = provider?.originalTools.find(
        (t) => t.name === toolData.tool,
      );

      if (!originalTool) {
        toast({
          title: "Error",
          description: "Original tool not found",
          variant: "destructive",
        });
        setCustomToolOperation(null);
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
          description: originalTool.description,
          inputSchema: originalTool.inputSchema,
        },
        overrideParams: toolData.parameters.reduce(
          (acc, param) => {
            // Only include param if it has a value or description
            const hasValue =
              param.value !== undefined &&
              param.value !== null &&
              param.value !== "";
            const hasDescription =
              param.description !== undefined && param.description !== "";

            if (hasValue || hasDescription) {
              acc[param.name] = {
                ...(hasValue ? { value: param.value } : {}),
                ...(hasDescription && param.description
                  ? {
                      description: {
                        action: "rewrite" as const,
                        text: param.description,
                      },
                    }
                  : {}),
              };
            }
            return acc;
          },
          {} as Record<
            string,
            {
              value?: string | number | boolean | null;
              description?: { action: "append" | "rewrite"; text: string };
            }
          >,
        ),
      };

      // Check if appConfig is available before creating custom tool
      const socketState = socketStore.getState();
      const { appConfig, isConnected, isPending } = socketState;

      if (!appConfig) {
        // Determine the specific error message
        let errorMessage = "App configuration is not available.";
        if (isPending) {
          errorMessage = "Connecting to server... Please wait a moment.";
        } else if (!isConnected) {
          errorMessage =
            "Disconnected from server. Please check your connection.";
        }

        toast({
          title: "Error",
          description: errorMessage,
          variant: "warning",
        });
        setCustomToolOperation(null);
        return;
      }

      // Set hasPendingChanges FIRST to prevent socket from overwriting
      accessControlsStore.setState({ hasPendingChanges: true });

      // Create tool extension via API
      const toolExtension: ToolExtension = {
        name: customTool.name,
        description: customTool.description,
        overrideParams: customTool.overrideParams,
      };
      await apiClient.createToolExtension(
        toolData.server,
        toolData.tool,
        toolExtension,
      );

      // Wait for socket to confirm the creation
      // Wait a bit to ensure UI updates, then close modal and reset
      setTimeout(() => {
        setCustomToolOperation(null);
        setIsCustomToolFullDialogOpen(false);

        setTimeout(() => {
          accessControlsStore.setState({ hasPendingChanges: false });
        }, 1000);
      }, 300);
    } catch (error) {
      console.error("Custom tool creation failed:", error);
      toast({
        title: "Error",
        description: "Failed to create custom tool",
        variant: "destructive",
      });
      setCustomToolOperation(null);
      accessControlsStore.setState({ hasPendingChanges: false });
    }
  };

  const handleEditCustomTool = (toolData: ToolCardTool) => {
    // Dismiss all existing toasts when opening edit dialog
    // This prevents edge cases where delete toasts remain visible while editing
    dismiss();

    // Find the provider and original tool to get the parameter schema
    const provider = providers.find((p) => p.name === toolData.serviceName);
    const originalTool = provider?.originalTools.find(
      (t) =>
        t.name ===
        (toolData.originalToolName || toolData.name.replace("Custom_", "")),
    );

    // Get override params from appConfig for this custom tool
    const toolExtensions = appConfig?.toolExtensions?.services || {};
    let overrideParams: ToolExtensionParamsRecord | undefined;
    const serviceName = toolData.serviceName;
    if (serviceName && toolExtensions[serviceName]) {
      for (const [_origToolName, toolExt] of Object.entries(
        toolExtensions[serviceName],
      )) {
        const childTools = toolExt.childTools || [];
        const found = childTools.find((ct) => ct.name === toolData.name);
        if (found) {
          overrideParams = found.overrideParams;
          break;
        }
      }
    }

    const descriptionText = toolData.description || "";

    const editData: EditingToolData = {
      server: toolData.serviceName || "",
      tool: toolData.originalToolName || toolData.name.replace("Custom_", ""), // Use original tool name
      name: toolData.name,
      originalName: toolData.name,
      description: descriptionText,
      parameters: originalTool?.inputSchema?.properties
        ? Object.entries(originalTool.inputSchema.properties).map(
            ([name, param]) => {
              const schemaParam = param as JsonSchemaProperty;
              // Use override value if it exists, otherwise use default
              const overrideValue = overrideParams?.[name]?.value;
              // Use custom description if it exists, otherwise use original
              const overrideDescription = overrideParams?.[name]?.description;
              const customDescription =
                typeof overrideDescription === "object"
                  ? overrideDescription?.text
                  : undefined;
              const originalDescription = schemaParam.description || "";
              const finalDescription = customDescription || originalDescription;
              return {
                name,
                description: finalDescription,
                value:
                  overrideValue !== undefined
                    ? String(overrideValue)
                    : schemaParam.default || "",
              };
            },
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

    // Set loading state to show full-page loader
    setIsCreating(true);
    if (editDialogMode === "edit") {
      setCustomToolOperation("editing");
    } else {
      setCustomToolOperation("creating");
    }

    try {
      const provider = providers.find((p) => p.name === toolData.server);

      let originalToolName: string | undefined;

      if (editDialogMode === "edit") {
        // For editing, we need to find the original tool by searching the config
        // since the custom tool data might not have the correct originalToolName
        const { appConfig } = socketStore.getState();
        const toolExtensions = appConfig?.toolExtensions?.services || {};

        for (const [serviceName, serviceTools] of Object.entries(
          toolExtensions,
        )) {
          if (serviceName !== toolData.server) continue;

          for (const [origToolName, toolExt] of Object.entries(serviceTools)) {
            const childTools = toolExt.childTools || [];
            const foundTool = childTools.find(
              (ct: ToolExtension) => ct.name === toolData.originalName,
            );
            if (foundTool) {
              originalToolName = origToolName;
              break;
            }
          }
          if (originalToolName) break;
        }
      } else {
        // For creating new tools, use the provided tool name
        originalToolName = toolData.tool;
      }

      if (!originalToolName) {
        toast({
          title: "Error",
          description: "Could not find original tool for custom tool",
          variant: "destructive",
        });
        return;
      }

      const originalTool = provider?.originalTools.find(
        (t) => t.name === originalToolName,
      );

      if (!originalTool) {
        toast({
          title: "Error",
          description: "Original tool not found",
          variant: "destructive",
        });
        return;
      }
      // Check if a tool with the same name already exists (custom or original)
      if (editDialogMode !== "edit") {
        const serverProvider = providers.find(
          (p) => p.name === toolData.server,
        );
        if (serverProvider) {
          const originalToolExists = serverProvider.originalTools.some(
            (tool) => tool.name === toolData.name,
          );

          if (originalToolExists) {
            toast({
              title: "Error",
              description: `A tool named "${toolData.name}" already exists as an original tool in this server. Please choose a different name.`,
              variant: "destructive",
            });
            return;
          }
        }

        const serverCustomToolNames = customToolNamesByServer.get(
          toolData.server,
        );
        if (serverCustomToolNames?.has(toolData.name)) {
          toast({
            title: "Error",
            description: `A custom tool named "${toolData.name}" already exists for this server. Please choose a different name.`,
            variant: "destructive",
          });
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
          id: toToolId(toolData.server, originalTool.name),
          name: originalTool.name,
          serviceName: toolData.server,
          description: originalTool.description,
          inputSchema: originalTool.inputSchema,
        },
        overrideParams: toolData.parameters.reduce(
          (acc, param) => {
            const hasValue =
              param.value !== undefined &&
              param.value !== null &&
              param.value !== "";
            const hasDescription =
              param.description !== undefined && param.description !== "";

            if (hasValue || hasDescription) {
              acc[param.name] = {
                ...(hasValue ? { value: param.value } : {}),
                ...(hasDescription && param.description
                  ? {
                      description: {
                        action: "rewrite" as const,
                        text: param.description,
                      },
                    }
                  : {}),
              };
            }
            return acc;
          },
          {} as Record<
            string,
            {
              value?: string | number | boolean | null;
              description?: { action: "append" | "rewrite"; text: string };
            }
          >,
        ),
      };

      accessControlsStore.setState({ hasPendingChanges: true });

      const toolExtension: ToolExtension = {
        name: customTool.name,
        description: customTool.description,
        overrideParams: customTool.overrideParams,
      };

      if (editDialogMode === "edit" && toolData.originalName) {
        const nameChanged = toolData.name !== toolData.originalName;

        if (nameChanged) {
          const serverProvider = providers.find(
            (p) => p.name === toolData.server,
          );
          if (serverProvider) {
            const originalToolExists = serverProvider.originalTools.some(
              (tool) => tool.name === toolData.name,
            );

            if (originalToolExists) {
              toast({
                title: "Error",
                description: `A tool named "${toolData.name}" already exists as an original tool in this server. Please choose a different name.`,
                variant: "destructive",
              });
              setIsCreating(false);
              setCustomToolOperation(null);
              accessControlsStore.setState({ hasPendingChanges: false });
              return;
            }
          }

          const serverCustomToolNames = customToolNamesByServer.get(
            toolData.server,
          );
          if (serverCustomToolNames?.has(toolData.name)) {
            toast({
              title: "Error",
              description: `A custom tool named "${toolData.name}" already exists for this server. Please choose a different name.`,
              variant: "destructive",
            });
            setIsCreating(false);
            setCustomToolOperation(null);
            accessControlsStore.setState({ hasPendingChanges: false });
            return;
          }

          await apiClient.deleteToolExtension(
            toolData.server,
            originalToolName,
            toolData.originalName,
          );
          await apiClient.createToolExtension(
            toolData.server,
            originalToolName,
            toolExtension,
          );
        } else {
          await apiClient.updateToolExtension(
            toolData.server,
            originalToolName,
            toolData.originalName,
            {
              description: toolExtension.description,
              overrideParams: toolExtension.overrideParams,
            },
          );
        }
      } else {
        await apiClient.createToolExtension(
          toolData.server,
          originalToolName,
          toolExtension,
        );
      }

      accessControlsStore.setState({ hasPendingChanges: true });

      setIsEditCustomToolDialogOpen(false);
      setCustomToolOperation(null);
      setEditingToolData(null);

      setTimeout(() => {
        accessControlsStore.setState({ hasPendingChanges: false });
      }, 1000);
    } catch (error) {
      console.error("Custom tool save failed:", error);
      toast({
        title: "Error",
        description: "Failed to save custom tool",
        variant: "destructive",
      });
      setIsCreating(false);
      setCustomToolOperation(null);
      accessControlsStore.setState({ hasPendingChanges: false });
    }
  };

  const handleDeleteCustomToolAction = async (customTool: ToolCardTool) => {
    setCustomToolOperation("deleting");

    try {
      const socketState = socketStore.getState();
      if (!socketState.appConfig) {
        toast({
          title: "Error",
          description: "Unable to delete. Please try again in a moment.",
          variant: "warning",
        });
        setCustomToolOperation(null);
        return;
      }

      accessControlsStore.setState({ hasPendingChanges: true });

      const { appConfig: currentAppConfig } = socketStore.getState();
      const toolExtensions = currentAppConfig?.toolExtensions?.services || {};
      let originalToolName: string | undefined;
      let customToolName: string | undefined;
      const toolServiceName = customTool.serviceName;

      for (const [serviceName, serviceTools] of Object.entries(
        toolExtensions,
      )) {
        if (serviceName !== toolServiceName) continue;

        for (const [origToolName, toolExt] of Object.entries(serviceTools)) {
          const childTools = toolExt.childTools || [];
          const found = childTools.find((ct) => ct.name === customTool.name);
          if (found) {
            originalToolName = origToolName;
            customToolName = customTool.name;
            break;
          }
        }
        if (originalToolName && customToolName) break;
      }

      if (originalToolName && customToolName && toolServiceName) {
        await apiClient.deleteToolExtension(
          toolServiceName,
          originalToolName,
          customToolName,
        );
      } else {
        throw new Error("Could not find tool extension to delete");
      }

      accessControlsStore.setState({ hasPendingChanges: false });
    } catch (error) {
      console.error("Failed to delete custom tool:", error);
      toast({
        title: "Error",
        description: "Failed to delete tool. Please try again.",
        variant: "destructive",
      });
      setCustomToolOperation(null);
      accessControlsStore.setState({ hasPendingChanges: false });
    }
  };

  const handleDeleteCustomTool = (customTool: ToolCardTool) => {
    const toastObj = toast({
      title: "Remove Custom Tool",
      description: (
        <>
          Are you sure you want to delete <strong>{customTool.name}</strong>?
        </>
      ),
      isClosable: true,
      duration: 1000000, // prevent toast disappear
      variant: "warning",
      action: (
        <Button
          variant="danger"
          onClick={async () => {
            // Dismiss the toast first
            if (toastObj && toastObj.dismiss) {
              toastObj.dismiss();
            }

            // Then handle the deletion
            await handleDeleteCustomToolAction(customTool);
          }}
        >
          Ok
        </Button>
      ),
    });
  };

  const handleDuplicateCustomTool = (toolData: ToolCardTool) => {
    // Dismiss all existing toasts when opening duplicate dialog
    // This prevents edge cases where delete toasts remain visible while duplicating
    dismiss();

    // Get the original tool to extract all parameters
    const provider = providers.find((p) => p.name === toolData.serviceName);
    const originalToolName = toolData.originalToolName;
    const originalTool = provider?.originalTools.find(
      (t) => t.name === originalToolName,
    );

    // Get override params from appConfig for this custom tool
    const toolExtensions = appConfig?.toolExtensions?.services || {};
    let overrideParams: ToolExtensionParamsRecord | undefined;
    const serviceName = toolData.serviceName;
    if (serviceName && toolExtensions[serviceName]) {
      for (const [_origToolName, toolExt] of Object.entries(
        toolExtensions[serviceName],
      )) {
        const childTools = toolExt.childTools || [];
        const found = childTools.find((ct) => ct.name === toolData.name);
        if (found) {
          overrideParams = found.overrideParams;
          break;
        }
      }
    }

    // Combine original tool parameters with override parameters
    const allParameters: Array<{
      name: string;
      description: string;
      value: string;
    }> = [];

    // Add original tool parameters
    if (originalTool?.inputSchema?.properties) {
      Object.entries(originalTool.inputSchema.properties).forEach(
        ([name, param]) => {
          const schemaParam = param as JsonSchemaProperty;
          allParameters.push({
            name,
            description: schemaParam.description || "",
            value: schemaParam.default || "",
          });
        },
      );
    }

    // Override with custom tool parameters if they exist
    if (overrideParams) {
      Object.entries(overrideParams).forEach(([name, param]) => {
        const existingParamIndex = allParameters.findIndex(
          (p) => p.name === name,
        );
        const paramDescription =
          typeof param.description === "object"
            ? param.description?.text || ""
            : "";
        const paramValue = param.value != null ? String(param.value) : "";
        if (existingParamIndex >= 0) {
          // Update existing parameter
          allParameters[existingParamIndex] = {
            name,
            description:
              paramDescription || allParameters[existingParamIndex].description,
            value: paramValue,
          };
        } else {
          // Add new parameter
          allParameters.push({
            name,
            description: paramDescription,
            value: paramValue,
          });
        }
      });
    }

    // Generate a unique name for the duplicate
    const baseName = toolData.name;
    let duplicateName = `${baseName}_Copy`;
    let counter = 1;

    // Check if the name already exists anywhere in this server and increment counter if needed
    const existingCustomTools: ToolExtensionsService =
      appConfig?.toolExtensions?.services?.[toolData.serviceName || ""] || {};

    while (true) {
      let nameExists = false;

      // Check all original tools in this server for name conflicts
      for (const [_originalToolName, existingToolExtensions] of Object.entries(
        existingCustomTools,
      )) {
        const childTools = existingToolExtensions.childTools || [];
        if (childTools.some((tool) => tool.name === duplicateName)) {
          nameExists = true;
          break;
        }
      }

      if (!nameExists) break;

      counter++;
      duplicateName = `${baseName} (Copy ${counter})`;
    }

    // toolData.description is already a string in ToolCardTool
    const descriptionText = toolData.description || "";

    const duplicateData: EditingToolData = {
      server: toolData.serviceName || "",
      tool: originalToolName || "",
      name: duplicateName,
      description: descriptionText,
      parameters: allParameters,
    };

    setEditingToolData(duplicateData);
    setEditDialogMode("duplicate");
    setIsEditCustomToolDialogOpen(true);
  };

  const handleCustomizeToolDialog = (toolData: ToolCardTool) => {
    // Pre-populate the dialog with the tool's server and tool information
    // toolData.description is already a string in ToolCardTool
    const descriptionText = toolData.description || "";
    const editData: EditingToolData = {
      server: toolData.serviceName || "",
      tool: toolData.name,
      name: `Custom_${toolData.name}`,
      description: descriptionText,
      parameters: toolData.inputSchema?.properties
        ? Object.entries(toolData.inputSchema.properties).map(
            ([name, param]) => {
              const schemaParam = param as JsonSchemaProperty;
              return {
                name,
                description: schemaParam.description || "",
                value: schemaParam.default || "",
              };
            },
          )
        : [],
    };
    setEditingToolData(editData);
    setEditDialogMode("customize");
    setIsCustomToolFullDialogOpen(true); // Use the create dialog, not edit dialog
  };

  const handleClickAddCustomToolMode = () => {
    setSelectedTools(new Set());
    setSelectedCustomToolKey(null);
    setIsEditMode(false);
    setIsCustomToolFullDialogOpen(false);
    setIsAddCustomToolMode(true);

    // Only expand providers that have tools (tools.length > 0)
    const providersSet = new Set(
      providers
        .filter((provider) => (provider.originalTools?.length || 0) > 0)
        .map((provider) => provider.name),
    );
    setExpandedProviders(providersSet);
  };

  const handleCancelAddCustomToolMode = () => {
    setIsAddCustomToolMode(false);
    setSelectedTools(new Set());
    setSelectedCustomToolKey(null);
    setExpandedProviders(new Set());
    setIsCustomToolFullDialogOpen(false);
    setEditingToolData(null);
  };

  return {
    selectedTools,
    setSelectedTools,
    showCreateModal,
    setShowCreateModal,
    newGroupName,
    setNewGroupName,
    newGroupDescription,
    handleNewGroupDescriptionChange,
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
    isAddCustomToolMode,
    setIsAddCustomToolMode,
    selectedCustomToolKey,
    setSelectedCustomToolKey,
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
    handleSelectAllTools,
    handleCreateToolGroup,
    handleSaveToolGroup,
    handleCloseCreateModal,
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
    handleGroupNavigation,
    handleGroupClick,
    handleProviderClick,
    handleEditGroup,
    handleDeleteGroup,
    handleUpdateGroupDescription,
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
    toolGroupOperation,
    customToolOperation,
  };
}
