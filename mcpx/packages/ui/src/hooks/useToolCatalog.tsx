import React, { useState, useMemo, useEffect } from "react";
import { validateToolGroupName } from "@/components/tools/ToolGroupSheet";
import { useSocketStore, useAccessControlsStore, initToolsStore, socketStore } from "@/store";
import { useUpdateAppConfig } from "@/data/app-config";
import { useToast } from "@/components/ui/use-toast";
import { useToolsStore } from "@/store/tools";
import { toToolId } from "@/utils";
import { toolGroupSchema, TargetServerNew } from "@mcpx/shared-model";
import z from "zod";

// Validate tool group object using the schema
const validateToolGroupObject = (toolGroup: any) => {
  try {
    // Create schema for single tool group (toolGroupSchema is an array schema)
    const singleToolGroupSchema = z.object({
      name: z.string().regex(/^[a-zA-Z0-9_\s-]{1,64}$/, "Tool group name must contain only letters, digits, spaces, underscores, and dashes (1-64 characters)"),
      services: z.record(
        z.string(),
        z.union([z.array(z.string()), z.literal("*")])
      ),
    });
    singleToolGroupSchema.parse(toolGroup);
    return { isValid: true };
  } catch (error: any) {
    return {
      isValid: false,
      error: error.errors?.[0]?.message || "Invalid tool group configuration"
    };
  }
};

// Clean up references to a deleted tool group from permissions config
const cleanToolGroupReferences = (permissions: any, deletedGroupName: string) => {
  const cleanedPermissions = { ...permissions };

  // Clean up default permissions
  if (cleanedPermissions.default) {
    if (cleanedPermissions.default._type === "default-allow" && cleanedPermissions.default.block) {
      cleanedPermissions.default.block = cleanedPermissions.default.block.filter(
        (groupName: string) => groupName !== deletedGroupName
      );
    } else if (cleanedPermissions.default._type === "default-block" && cleanedPermissions.default.allow) {
      cleanedPermissions.default.allow = cleanedPermissions.default.allow.filter(
        (groupName: string) => groupName !== deletedGroupName
      );
    }
  }

  // Clean up consumer permissions
  if (cleanedPermissions.consumers) {
    Object.keys(cleanedPermissions.consumers).forEach((consumerKey) => {
      const consumer = cleanedPermissions.consumers[consumerKey];
      // Clean up toolGroups array if it exists
      if (consumer.toolGroups) {
        consumer.toolGroups = consumer.toolGroups.filter(
          (groupName: string) => groupName !== deletedGroupName
        );
      }
      // Clean up allow array if it exists (for consumers with specific permissions)
      if (consumer.allow) {
        consumer.allow = consumer.allow.filter(
          (groupName: string) => groupName !== deletedGroupName
        );
      }
      // Clean up block array if it exists
      if (consumer.block) {
        consumer.block = consumer.block.filter(
          (groupName: string) => groupName !== deletedGroupName
        );
      }
    });
  }

  return cleanedPermissions;
};

// Update references to a renamed tool group from permissions config
const updateToolGroupNameReferences = (permissions: any, oldName: string, newName: string) => {
  const updatedPermissions = { ...permissions };

  // Update default permissions
  if (updatedPermissions.default) {
    if (updatedPermissions.default._type === "default-allow" && updatedPermissions.default.block) {
      updatedPermissions.default.block = updatedPermissions.default.block.map(
        (groupName: string) => groupName === oldName ? newName : groupName
      );
    } else if (updatedPermissions.default._type === "default-block" && updatedPermissions.default.allow) {
      updatedPermissions.default.allow = updatedPermissions.default.allow.map(
        (groupName: string) => groupName === oldName ? newName : groupName
      );
    }
  }

  // Update consumer permissions
  if (updatedPermissions.consumers) {
    Object.keys(updatedPermissions.consumers).forEach((consumerKey) => {
      const consumer = updatedPermissions.consumers[consumerKey];
      // Update toolGroups array if it exists
      if (consumer.toolGroups) {
        consumer.toolGroups = consumer.toolGroups.map(
          (groupName: string) => groupName === oldName ? newName : groupName
        );
      }
      // Update allow array if it exists (for consumers with specific permissions)
      if (consumer.allow) {
        consumer.allow = consumer.allow.map(
          (groupName: string) => groupName === oldName ? newName : groupName
        );
      }
      // Update block array if it exists
      if (consumer.block) {
        consumer.block = consumer.block.map(
          (groupName: string) => groupName === oldName ? newName : groupName
        );
      }
    });
  }

  return updatedPermissions;
};
import { Button } from "@/components/ui/button";


export function useToolCatalog(toolsList: Array<any> = []) {
  const { systemState, appConfig, emitPatchAppConfig } = useSocketStore((s) => ({
    systemState: s.systemState,
    appConfig: s.appConfig,
    emitPatchAppConfig: s.emitPatchAppConfig,
  }));

  const { toolGroups, setToolGroups } = useAccessControlsStore((s) => ({
    toolGroups: s.toolGroups,
    setToolGroups: s.setToolGroups,
  }));

  const { mutateAsync: updateAppConfigAsync } = useUpdateAppConfig();
  const { toast, dismiss } = useToast();
  const { createCustomTool, updateCustomTool } = useToolsStore((s) => ({
    createCustomTool: s.createCustomTool,
    updateCustomTool: s.updateCustomTool,
  }));

  // State
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [createGroupError, setCreateGroupError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [recentlyCreatedGroupIds, setRecentlyCreatedGroupIds] = useState<Set<string>>(new Set());
  const [recentlyModifiedProviders, setRecentlyModifiedProviders] = useState<Set<string>>(new Set());
  const [recentlyModifiedGroupIds, setRecentlyModifiedGroupIds] = useState<Set<string>>(new Set());
  const [cleanupTimeouts, setCleanupTimeouts] = useState<Map<string, NodeJS.Timeout>>(new Map());
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [selectedToolGroup, setSelectedToolGroup] = useState<string | null>(
    null,
  );
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(
    new Set(),
  );

  // Synchronize tool groups with app config to remove orphaned groups
  useEffect(() => {
    if (appConfig?.toolGroups) {
      const configGroups = appConfig.toolGroups;
      const localGroups = toolGroups;

      const configGroupNames = new Set(configGroups.map(g => g.name));

      // Find tool groups in UI that don't exist in config and aren't recently created or modified
      const orphanedGroups = localGroups.filter(g =>
        !configGroupNames.has(g.name) && 
        !recentlyCreatedGroupIds.has(g.id) && 
        !recentlyModifiedGroupIds.has(g.id)
      );

      if (orphanedGroups.length > 0) {
        console.log("[ToolCatalog] Removing orphaned tool groups:", orphanedGroups.map(g => g.name));
        const synchronizedGroups = localGroups.filter(g =>
          configGroupNames.has(g.name) || 
          recentlyCreatedGroupIds.has(g.id) || 
          recentlyModifiedGroupIds.has(g.id)
        );
        setToolGroups(synchronizedGroups);
      }
    }
  }, [appConfig?.toolGroups, toolGroups, recentlyCreatedGroupIds, recentlyModifiedGroupIds]);
  
  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      cleanupTimeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [cleanupTimeouts]);
  
  const [isToolGroupDialogOpen, setIsToolGroupDialogOpen] = useState(false);
  const [selectedToolGroupForDialog, setSelectedToolGroupForDialog] =
    useState<any>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isCustomToolFullDialogOpen, setIsCustomToolFullDialogOpen] =
    useState(false);
  const [isAddCustomToolMode, setIsAddCustomToolMode] = useState(false);
  const [selectedCustomToolKey, setSelectedCustomToolKey] = useState<string | null>(null);
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

  // Cleanup toasts when component unmounts
  React.useEffect(() => {
    return () => {
      // Dismiss all toasts when component unmounts
      dismiss();
    };
  }, []);

  // Dismiss edit mode toast when exiting edit mode
  React.useEffect(() => {
    if (!isEditMode) {
      // Use setTimeout to avoid immediate re-render issues
      setTimeout(() => dismiss(), 0);
    }
  }, [isEditMode]); // Remove dismiss from dependencies to avoid loops

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

    // During brief moments when server state hasn't updated yet,
    // keep providers that were recently modified to prevent flickering
    const serverProviderNames = new Set(filteredProviders.map(p => p.name));
    const missingProviders = Array.from(recentlyModifiedProviders)
      .filter(providerName => !serverProviderNames.has(providerName))
      .map(providerName => ({
        name: providerName,
        originalTools: [],
        state: { type: 'connected' as const },
        icon: undefined,
        url: '',
        tools: [],
        usage: [],
        headers: {},
        severity: 'info' as const
      } as unknown as TargetServerNew));

    filteredProviders = [...filteredProviders, ...missingProviders];

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
            overrideParams: tool.overrideParams,
            parameterDescriptions: tool.parameterDescriptions,
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
        .filter((provider) => provider.originalTools.length > 0 );
    }

    return filteredProviders;
  }, [
    systemState?.targetServers_new,
    searchQuery,
    toolsList,
    selectedToolGroup,
    toolGroups,
    recentlyModifiedProviders,
  ]);

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
    tool: any,
    providerName: string,
    isSelected: boolean,
  ) => {
    const toolKey = `${providerName}:${tool.name}`;

    if (isAddCustomToolMode) {
      if (!isSelected) {
        console.log("[CustomTool] Deselected tool in add mode, clearing state");
        setSelectedTools(new Set());
        setSelectedCustomToolKey(null);
        return;
      }

      console.log("[CustomTool] Tool selected", { toolKey, providerName });
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
      id: `${Date.now()}`,
      name: newGroupName.trim(),
      description: "",
      services: Object.fromEntries(toolsByProvider),
      tools: Array.from(toolsByProvider.entries()).flatMap(
        ([providerName, toolNames]) =>
          toolNames.map((toolName) => ({ provider: providerName, name: toolName })),
      ),
    };

    // Mark this group as recently created to prevent it from being removed during sync
    setRecentlyCreatedGroupIds(prev => new Set(prev).add(newToolGroup.id));

    // Optimistically update UI immediately
    setToolGroups(prev => [...prev, newToolGroup]);

    const newToolGroups = [...toolGroups, newToolGroup];

    try {
      // For large tool groups, show loading state and wait for backend confirmation
      // This prevents state synchronization issues with optimistic updates
      setIsCreating(true);

      const currentAppConfig = appConfig;
      if (currentAppConfig) {
        const updatedAppConfig = {
          ...currentAppConfig,
          toolGroups: newToolGroups.map((group) => ({
            name: group.name,
            description: group.description,
            services: group.services,
          })),
        };

        // Wait for backend confirmation before updating UI
        await emitPatchAppConfig(updatedAppConfig);

        // Only update local state after successful backend confirmation
        setToolGroups(newToolGroups);

        // Clear the recently created group ID since server has confirmed
        setRecentlyCreatedGroupIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(newToolGroup.id);
          return newSet;
        });

        // Scroll to the newly created group after a brief delay to allow DOM updates
        setTimeout(() => {
          const newGroupId = newToolGroup.id;
          console.log('Attempting to scroll to new group:', newGroupId);

          // First scroll to the tool groups section
          const toolGroupsSection = document.querySelector('[class*="bg-white"][class*="rounded-lg"][class*="p-6"][class*="shadow-sm"]');
          if (toolGroupsSection) {
            console.log('Scrolling to tool groups section first');
            toolGroupsSection.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            });

            // Then scroll to the specific group after the section scroll
            setTimeout(() => {
              const groupElement = document.querySelector(`[data-group-id="${newGroupId}"]`);
              console.log('Found group element:', groupElement);

              if (groupElement) {
                // Calculate which page the new group should be on
                const groupIndex = newToolGroups.findIndex(g => g.id === newGroupId);
                const pageIndex = Math.floor(groupIndex / 8);

                console.log('Group index:', groupIndex, 'Page index:', pageIndex, 'Current page:', currentGroupIndex);

                // Navigate to the correct page if needed
                if (pageIndex !== currentGroupIndex) {
                  console.log('Navigating to page:', pageIndex);
                  setCurrentGroupIndex(pageIndex);

                  // Wait for the page navigation to complete, then scroll
                  setTimeout(() => {
                    const updatedGroupElement = document.querySelector(`[data-group-id="${newGroupId}"]`);
                    console.log('After page navigation, found element:', updatedGroupElement);
                    if (updatedGroupElement) {
                      console.log('Scrolling to element');
                      updatedGroupElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                        inline: 'center'
                      });
                    }
                  }, 600);
                } else {
                  // Already on the correct page, just scroll to the group
                  console.log('Scrolling to element on current page');

                  // Try multiple scroll approaches
                  groupElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                    inline: 'center'
                  });

                  // Also try focusing the element as a fallback
                  setTimeout(() => {
                    (groupElement as HTMLElement).focus?.({ preventScroll: false });
                  }, 100);
                }
              } else {
                console.log('Group element not found, all data-group-id elements:', Array.from(document.querySelectorAll('[data-group-id]')).map(el => el.getAttribute('data-group-id')));
              }
            }, 400);
          }
        }, 300);

        // Close modal and reset state
        setShowCreateModal(false);
        setIsEditMode(false);
        setNewGroupName("");
        setSelectedTools(new Set());
        setOriginalSelectedTools(new Set());
        setExpandedProviders(new Set());
        setIsCreating(false);
      }
    } catch (error) {
      console.error("Error creating tool group:", error);
      setCreateGroupError("Failed to create tool group. Please try again.");
      setIsCreating(false);

      // Remove from recently created groups since creation failed
      setRecentlyCreatedGroupIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(newToolGroup.id);
        return newSet;
      });
    }
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setNewGroupName("");
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

  const fixToolGroupConfiguration = (group: any) => {
    if (!group.services) return group;
    
    const fixedServices = { ...group.services };
    let hasChanges = false;
    
    Object.entries(fixedServices).forEach(([providerName, toolNames]: [string, any]) => {
      if (Array.isArray(toolNames)) {
        const provider = providers.find(p => p.name === providerName);
        const availableTools = provider?.originalTools?.map(t => t.name) || [];
        
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
      setToolGroups(prev => prev.map(g => g.id === group.id ? updatedGroup : g));
      
      // Update the backend configuration
      const currentAppConfig = appConfig;
      if (currentAppConfig) {
        const updatedAppConfig = {
          ...currentAppConfig,
          toolGroups: currentAppConfig.toolGroups.map((tg, index) =>
            tg.name === group.name ? {
              name: tg.name,
              description: group.description,
              services: fixedServices
            } : tg
          ),
        };
        emitPatchAppConfig(updatedAppConfig);
      }
      
      return updatedGroup;
    }
    
    return group;
  };

  const handleEditGroup = (group: any) => {
    const fixedGroup = fixToolGroupConfiguration(group);

    toast({
      title: "Editing Tool Group",
      description: `You are editing tool group "${fixedGroup.name}"`,
isClosable : false,
      duration : 1000000, // prevent toast disappear
      variant:"info", // added new variant

      position: "top-center",
    });





    // Close the tool group sheet
    setSelectedToolGroupForDialog(null);
    setIsToolGroupDialogOpen(false);


    // Set up edit mode
    setEditingGroup(fixedGroup);
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
            // Find the provider to get available tools
            const provider = providers.find(p => p.name === providerName);
            const availableTools = provider?.originalTools?.map(t => t.name) || [];
            
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
        },
      );
    } else if (group.tools && Array.isArray(group.tools)) {
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




  const handleDeleteGroupAction = async (group: any) => {
    console.log("[ToolCatalog] handleDeleteGroupAction", {
      groupId: group?.id,
      groupName: group?.name,
    });
    console.log("[ToolCatalog] Current tool groups:", toolGroups.map(g => g.name));
    console.log("[ToolCatalog] Current app config tool groups:", appConfig?.toolGroups?.map(g => g.name));
    try {
      const updatedGroups = toolGroups.filter((g) => g.id !== group.id);
      console.log("[ToolCatalog] Updated groups after filter", updatedGroups.map((g) => g.name));
      setToolGroups(updatedGroups);

      // Update app config
      const currentAppConfig = appConfig;
      if (currentAppConfig) {
      // Clean up references to the deleted tool group from permissions
      const cleanedPermissions = cleanToolGroupReferences(currentAppConfig.permissions, group.name);

      const updatedAppConfig = {
        ...currentAppConfig,
        toolGroups: updatedGroups.map((g) => ({
          name: g.name,
          description: g.description,
          services: g.services,
        })),
        permissions: cleanedPermissions,
      };

      console.log("[ToolCatalog] Cleaned permissions:", cleanedPermissions);
      console.log("[ToolCatalog] Sending updatedAppConfig", updatedAppConfig.toolGroups);
        await updateAppConfigAsync(updatedAppConfig);
        console.log("[ToolCatalog] updateAppConfigAsync resolved successfully");
      } else {
        console.warn("[ToolCatalog] No currentAppConfig available when deleting group");
      }

      // Close the sheet
      setSelectedToolGroupForDialog(null);
      setIsToolGroupDialogOpen(false);
      console.log("[ToolCatalog] Tool group dialog closed after delete");
    } catch (error) {
      console.error("[ToolCatalog] Failed to delete tool group", error);
      toast({
        title: "Error",
        description: "Failed to delete tool group. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateGroupName = async (groupId: string, newName: string) => {
    try {
      // Clear any existing timeout for this group
      setCleanupTimeouts(prev => {
        const existingTimeout = prev.get(groupId);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }
        return prev;
      });
      
      // Mark group as recently modified to prevent orphaned cleanup
      setRecentlyModifiedGroupIds(prev => new Set(prev).add(groupId));
      
      // Update local state first
      const updatedGroups = toolGroups.map((group) =>
        group.id === groupId ? { ...group, name: newName } : group
      );
      setToolGroups(updatedGroups);

      // Update the selected tool group for dialog if it's the same group
      if (selectedToolGroupForDialog && selectedToolGroupForDialog.id === groupId) {
        setSelectedToolGroupForDialog({
          ...selectedToolGroupForDialog,
          name: newName,
        });
      }

      // Update backend
      const currentAppConfig = appConfig;
      if (currentAppConfig) {
        const updatedAppConfig = {
          ...currentAppConfig,
          toolGroups: updatedGroups.map((group) => ({
            name: group.name,
            description: group.description,
            services: group.services,
          })),
        };
        await emitPatchAppConfig(updatedAppConfig);
        
        // Clear recently modified status after successful update with proper timeout management
        const timeoutId = setTimeout(() => {
          setRecentlyModifiedGroupIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(groupId);
            return newSet;
          });
          setCleanupTimeouts(prev => {
            const newMap = new Map(prev);
            newMap.delete(groupId);
            return newMap;
          });
        }, 2000); // Increased to 2 seconds for more safety
        
        setCleanupTimeouts(prev => new Map(prev).set(groupId, timeoutId));
      }
    } catch (error) {
      console.error("Error updating tool group name:", error);
      toast({
        title: "Error",
        description: "Failed to update tool group name",
        variant: "destructive",
      });
    }
  };

  const handleUpdateGroupDescription = async (groupId: string, description: string) => {
    try {
      // Update local state first
      const updatedGroups = toolGroups.map((group) =>
        group.id === groupId ? { ...group, description: description } : group
      );
      setToolGroups(updatedGroups);

      // Update the selected tool group for dialog if it's the same group
      if (selectedToolGroupForDialog && selectedToolGroupForDialog.id === groupId) {
        setSelectedToolGroupForDialog({
          ...selectedToolGroupForDialog,
          description: description,
        });
      }

      // Update backend
      const currentAppConfig = appConfig;
      if (currentAppConfig) {
        const updatedAppConfig = {
          ...currentAppConfig,
          toolGroups: updatedGroups.map((group) => ({
            name: group.name,
            description: group.description,
            services: group.services,
          })),
        };

        await emitPatchAppConfig(updatedAppConfig);
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

  const handleDeleteGroup = (group: any) => {
    console.log("[ToolCatalog] handleDeleteGroup called for:", group?.name);
    let toastObj = toast({
      title: "Remove Tool Group",
      description: `Are you sure you want to delete the tool group "${group.name}"?`,
isClosable:true,
      duration : 1000000, // prevent toast disappear
      variant:"warning", // added new variant
      action: (
        <Button variant="warning" // added new variant
          onClick={() => {
            console.log("[ToolCatalog] Delete confirmed for:", group?.name);
            handleDeleteGroupAction(group);
            toastObj.dismiss();
          }}
        >
          Ok
        </Button>
      ),
      position: "top-center",
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

    // Check for duplicate names (excluding current group)
    if (
      toolGroups.some(
        (group) =>
          group.name === editingGroup.name && group.id !== editingGroup.id,
      )
    ) {
      toast({
        title: "Error",
        description:
          "A tool group with this name already exists. Please choose a different name.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingGroupChanges(true);

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

      const updatedGroups = toolGroups.map((g) =>
        g.id === editingGroup.id ? updatedGroup : g,
      );
      setToolGroups(updatedGroups);

      // Update app config
      const currentAppConfig = appConfig;
      if (currentAppConfig) {
        // If the tool group name changed, update references in permissions
        let updatedPermissions = currentAppConfig.permissions;
        if (editingGroup.name !== updatedGroup.name) {
          updatedPermissions = updateToolGroupNameReferences(
            currentAppConfig.permissions,
            editingGroup.name,
            updatedGroup.name
          );
        }

        const updatedAppConfig = {
          ...currentAppConfig,
          toolGroups: updatedGroups.map((g) => ({
            name: g.name,
            services: g.services,
          })),
          permissions: updatedPermissions,
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
      // Rollback UI state if server validation fails
      setToolGroups(originalGroups);

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
            const trimmedDescription = param.description?.trim();
            acc[param.name] = {
              value: param.value || "",
              ...(trimmedDescription
                ? {
                    description: {
                      action: "rewrite" as const,
                      text: trimmedDescription,
                    },
                  }
                : {}),
            };
            return acc;
          },
          {} as Record<string, { value: string; description?: { action: "append" | "rewrite"; text: string } }>,
        ),
      };

      // Mark provider as recently modified to prevent flickering
      setRecentlyModifiedProviders(prev => new Set(prev).add(toolData.server));

      const appConfigPayload = createCustomTool(customTool);

      await updateAppConfigAsync(appConfigPayload);
      // Ensure UI state reflects latest appConfig immediately
      initToolsStore();

      // Clear the recently modified provider marking
      setTimeout(() => {
        setRecentlyModifiedProviders(prev => {
          const newSet = new Set(prev);
          newSet.delete(toolData.server);
          return newSet;
        });
      }, 500);

      // Expand the provider where the custom tool was added so user can see it
      console.log("Expanding provider for custom tool:", toolData.server);
      setExpandedProviders(prev => new Set([...prev, toolData.server]));

      // Scroll to the newly created custom tool card
      setTimeout(() => {
        console.log("🔍 Starting scroll to custom tool:", toolData.name, "in provider:", toolData.server);
        
        // First scroll to the provider section to ensure it's visible
        const providerSection = document.querySelector(`[data-provider-name="${toolData.server}"]`);
        if (providerSection) {
          console.log("📍 Scrolling to provider section first");
          providerSection.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }

        // Then find and scroll to the specific tool card
        setTimeout(() => {
          const toolCardSelector = `[data-tool-name="${toolData.name}"][data-provider="${toolData.server}"]`;
          const toolCard = document.querySelector(toolCardSelector);

          console.log("🎯 Looking for tool card:", toolCardSelector);
          console.log("🎯 Found tool card:", toolCard);

          if (toolCard) {
            console.log("✅ Scrolling to newly created custom tool");
            toolCard.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
              inline: 'center'
            });

            // Add a highlight effect
            toolCard.classList.add('ring-4', 'ring-green-400', 'ring-opacity-75');
            setTimeout(() => {
              toolCard.classList.remove('ring-4', 'ring-green-400', 'ring-opacity-75');
            }, 3000);
          } else {
            console.log("❌ Tool card not found, trying alternative selectors");

            // Try alternative selectors if the specific one doesn't work
            const alternativeSelectors = [
              `[data-tool-name*="${toolData.name}"]`,
              `[title*="${toolData.name}"]`,
              `h3:contains("${toolData.name}")`,
              `[data-provider="${toolData.server}"] h3`
            ];

            for (const selector of alternativeSelectors) {
              const element = document.querySelector(selector);
              if (element) {
                console.log("✅ Found element with selector:", selector);
                element.scrollIntoView({
                  behavior: 'smooth',
                  block: 'center'
                });
                
                // Add highlight to found element
                element.classList.add('ring-4', 'ring-green-400', 'ring-opacity-75');
                setTimeout(() => {
                  element.classList.remove('ring-4', 'ring-green-400', 'ring-opacity-75');
                }, 3000);
                break;
              }
            }

            // Debug: List all available tool cards
            const allToolCards = document.querySelectorAll('[data-tool-name]');
            console.log("🔍 All available tool cards:", Array.from(allToolCards).map(card => ({
              name: card.getAttribute('data-tool-name'),
              provider: card.getAttribute('data-provider')
            })));
          }
        }, 300); // Wait for provider scroll to complete
      }, 800); // Increased delay to ensure DOM updates

      setIsCustomToolFullDialogOpen(false);
    } catch (error) {
      console.error('Custom tool creation failed:', error);
      toast({
        title: "Error",
        description: "Failed to create custom tool",
        variant: "destructive",
      });

      // Clear the recently modified provider marking on error
      setRecentlyModifiedProviders(prev => {
        const newSet = new Set(prev);
        newSet.delete(toolData.server);
        return newSet;
      });
    } finally {
      setIsSavingCustomTool(false);
    }
  };

  const handleEditCustomTool = (toolData: any) => {
    // Find the provider and original tool to get the parameter schema
    const provider = providers.find((p) => p.name === (toolData.serviceName || toolData.server));
    const originalTool = provider?.originalTools.find(
      (t: any) => t.name === (toolData.originalToolName || toolData.name.replace('Custom_', ''))
    );

    const editData = {
      server: toolData.serviceName || toolData.server,
      tool: toolData.originalToolName || toolData.name.replace('Custom_', ''), // Use original tool name
      name: toolData.name,
      originalName: toolData.name,
      description: toolData.description?.text || toolData.description || "",
      parameters: originalTool?.inputSchema?.properties
        ? Object.entries(originalTool.inputSchema.properties).map(
            ([name, param]: [string, any]) => {
              // Use override value if it exists, otherwise use default
              const overrideValue = toolData.overrideParams?.[name]?.value;
              // Use custom description if it exists, otherwise use original
              const customDescription = toolData.parameterDescriptions?.[name];
              const originalDescription = param.description || "";
              const finalDescription = customDescription || originalDescription;
              return {
                name,
                description: finalDescription,
                value: overrideValue !== undefined ? overrideValue : (param.default || ""),
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

    setIsSavingCustomTool(true);
    try {
      const provider = providers.find((p) => p.name === toolData.server);

      let originalToolName: string | undefined;
      let originalTool: any;

      if (editDialogMode === "edit") {
        // For editing, we need to find the original tool by searching the config
        // since the custom tool data might not have the correct originalToolName
        const { appConfig } = socketStore.getState();
        const toolExtensions = appConfig?.toolExtensions?.services || {};

        for (const [serviceName, serviceTools] of Object.entries(toolExtensions)) {
          if (serviceName !== toolData.server) continue;

          for (const [origToolName, toolExt] of Object.entries(serviceTools as any)) {
            const childTools = (toolExt as any).childTools || [];
            const foundTool = childTools.find((ct: any) => ct.name === toolData.originalName);
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
        setIsSavingCustomTool(false);
        return;
      }

      originalTool = provider?.originalTools.find(
        (t: any) => t.name === originalToolName,
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
          id: toToolId(toolData.server, originalTool.name),
          name: originalTool.name,
          serviceName: toolData.server,
          description: originalTool.description || "",
          inputSchema: originalTool.inputSchema,
        },
        overrideParams: toolData.parameters.reduce(
          (acc, param) => {
            const trimmedDescription = param.description?.trim();
            acc[param.name] = {
              value: param.value || "",
              ...(trimmedDescription
                ? {
                    description: {
                      action: "rewrite" as const,
                      text: trimmedDescription,
                    },
                  }
                : {}),
            };
            return acc;
          },
          {} as Record<string, { value: string; description?: { action: "append" | "rewrite"; text: string } }>,
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

      // Update local store immediately with the new config
      initToolsStore();

  

      setIsEditCustomToolDialogOpen(false);
      setEditingToolData(null);
    } catch (error) {
      console.error('Custom tool save failed:', error);
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
    let duplicateName = `${baseName}_Copy`;
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
    // Pre-populate the dialog with the tool's server and tool information
    setEditingToolData({
      server: toolData.serviceName,
      tool: toolData.name,
      name: `Custom_${toolData.name}`,
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
    });
    setEditDialogMode("customize");
    setIsCustomToolFullDialogOpen(true); // Use the create dialog, not edit dialog
  };

  const handleCloseCustomToolFullDialog = () => {
    setIsCustomToolFullDialogOpen(false);
    setEditingToolData(null);
    setSelectedCustomToolKey(null);
    setIsAddCustomToolMode(false);
    setSelectedTools(new Set());
    setExpandedProviders(new Set());
  };

  const handleClickAddCustomToolMode = () => {
    console.log("[CustomTool] Entering add-custom-tool mode");
    setSelectedTools(new Set());
    setSelectedCustomToolKey(null);
    setIsEditMode(false);
    setIsCustomToolFullDialogOpen(false);
    setIsAddCustomToolMode(true);

    const providersSet = new Set(providers.map((provider) => provider.name));
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
  };
}
