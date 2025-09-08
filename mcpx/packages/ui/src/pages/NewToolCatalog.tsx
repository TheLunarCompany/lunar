import { useSocketStore, useAccessControlsStore } from "@/store";
import { TargetServerNew } from "@mcpx/shared-model";
import { Lock, Plus, Trash2, ChevronLeft, ChevronRight, X, Search } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { useUpdateAppConfig } from "@/data/app-config";
import { ToolCard } from "@/components/tools/ToolCard";
import { ToolGroupSheet } from "@/components/tools/ToolGroupSheet";
import { ProviderCard } from "@/components/tools/ProviderCard";
import { CustomToolDialog } from "@/components/tools/CustomToolDialog";
import { useToolsStore } from "@/store/tools";
import { toToolId } from "@/utils";
import YAML from "yaml";
import { AddServerModal } from "@/components/dashboard/AddServerModal";
import { NoToolGroupsPlaceholder, NoServersPlaceholder, NoToolsFoundPlaceholder } from "@/components/tools/EmptyStatePlaceholders";
import { ToolDetailsDialog } from "@/components/tools/ToolDetailsDialog";






interface NewToolCatalogProps {
  searchFilter?: string;
  toolsList?: Array<any>;
  handleEditClick: (tool: any) => void;
  handleDuplicateClick: (tool: any) => void;
  handleDeleteTool: (tool: any) => void;
  handleCustomizeTool: (tool: any) => void;
}

export default function NewToolCatalog({ 
  searchFilter = "", 
  toolsList = [],
  handleEditClick,
  handleDuplicateClick,
  handleDeleteTool,
  handleCustomizeTool
}: NewToolCatalogProps) {
  const { systemState, appConfig } = useSocketStore((s) => ({
    systemState: s.systemState,
    appConfig: s.appConfig,
  }));

  const { toolGroups, setToolGroups, appConfigUpdates, hasPendingChanges, setAppConfigUpdates } = useAccessControlsStore((s) => ({
    toolGroups: s.toolGroups,
    setToolGroups: s.setToolGroups,
    appConfigUpdates: s.appConfigUpdates,
    hasPendingChanges: s.hasPendingChanges,
    setAppConfigUpdates: s.setAppConfigUpdates,
  }));

  const { mutateAsync: updateAppConfigAsync, isPending } = useUpdateAppConfig();
  const { toast } = useToast();
  const { createCustomTool, updateCustomTool } = useToolsStore((s) => ({
    createCustomTool: s.createCustomTool,
    updateCustomTool: s.updateCustomTool,
  }));

  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [selectedToolGroup, setSelectedToolGroup] = useState<string | null>(null);
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());
  const [isToolGroupDialogOpen, setIsToolGroupDialogOpen] = useState(false);
  const [selectedToolGroupForDialog, setSelectedToolGroupForDialog] = useState<any>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isCustomToolFullDialogOpen, setIsCustomToolFullDialogOpen] = useState(false);
  const [isEditCustomToolDialogOpen, setIsEditCustomToolDialogOpen] = useState(false);
  const [editingToolData, setEditingToolData] = useState<any>(null);
  const [editDialogMode, setEditDialogMode] = useState<'edit' | 'duplicate' | 'customize'>('edit');
  const [isSavingCustomTool, setIsSavingCustomTool] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddServerModalOpen, setIsAddServerModalOpen] = useState(false);
  const [isToolDetailsDialogOpen, setIsToolDetailsDialogOpen] = useState(false);
  const [selectedToolForDetails, setSelectedToolForDetails] = useState<any>(null);
  const [editingGroup, setEditingGroup] = useState<any>(null);
  const [originalSelectedTools, setOriginalSelectedTools] = useState<Set<string>>(new Set());
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
    filteredProviders = filteredProviders.filter(provider => 
      provider.state?.type !== "connection-failed"
    );
    
    const customToolsByProvider = toolsList
      .filter(tool => tool.originalToolId)
      .reduce((acc, tool) => {
        const providerName = tool.serviceName;
        if (!acc[providerName]) {
          acc[providerName] = [];
        }
        acc[providerName].push({
          name: tool.name,
          description: typeof tool.description === 'string' ? tool.description : tool.description?.text || '',
          serviceName: tool.serviceName,
          originalToolId: tool.originalToolId,
          originalToolName: tool.originalToolName,
          isCustom: true,
        });
        return acc;
      }, {} as Record<string, any[]>);

    filteredProviders = filteredProviders.map(provider => ({
      ...provider,
      originalTools: [
        ...provider.originalTools.map(tool => ({
          ...tool,
          serviceName: provider.name
        })),
        ...(customToolsByProvider[provider.name] || [])
      ]
    }));

    // Filter by search term
    if (searchQuery) {
      filteredProviders = filteredProviders.map(provider => ({
        ...provider,
        originalTools: provider.originalTools.filter(tool => 
          tool.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      })).filter(provider => provider.originalTools.length > 0);
    }
    
    // Filter by custom tools only
    
    return filteredProviders;
  }, [systemState?.targetServers_new, searchQuery, toolsList, selectedToolGroup, toolGroups]);

  // Calculate total filtered tools for display
  const totalFilteredTools = useMemo(() => {
    return providers.reduce((total, provider) => total + provider.originalTools.length, 0);
  }, [providers]);

  const handleToolSelectionChange = (toolName: string, providerName: string, isSelected: boolean) => {
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
    
    if (toolGroups.some(group => group.name === newGroupName.trim())) {
      toast({
        title: "Error",
        description: "A tool group with this name already exists. Please choose a different name.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);

    try {
      const toolsByProvider = new Map<string, string[]>();
      
      selectedTools.forEach(toolKey => {
        const [providerName, toolName] = toolKey.split(':');
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

      setToolGroups(prev => [...prev, newToolGroup]);
      await new Promise(resolve => setTimeout(resolve, 0));
      
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
              }
            ]
          };

          await updateAppConfigAsync({
            yaml: YAML.stringify(updatedAppConfig)
          });

          toast({
            title: "Success",
            description: `Tool group "${newGroupName.trim()}" created successfully!`,
          });
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Tool group created but failed to save. Please try again.",
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

  const handleCloseCustomToolFullDialog = () => {
    setIsCustomToolFullDialogOpen(false);
  };

  const handleCreateCustomTool = async (toolData: {
    server: string;
    tool: string;
    name: string;
    description: string;
    parameters: Array<{name: string, description: string, value: string}>;
  }) => {
    try {
      const provider = providers.find(p => p.name === toolData.server);
      const originalTool = provider?.originalTools.find((t: any) => t.name === toolData.tool);
      
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
        overrideParams: toolData.parameters.reduce((acc, param) => {
          if (param.value) {
            acc[param.name] = { value: param.value };
          }
          return acc;
        }, {} as Record<string, { value: string }>),
      };

      const appConfigPayload = createCustomTool(customTool);
      const newAppConfig = {
        yaml: YAML.stringify(appConfigPayload),
      };

      await updateAppConfigAsync(newAppConfig);

      toast({
        title: "Success",
        description: "Custom tool created successfully",
      });

      handleCloseCustomToolFullDialog();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create custom tool",
        variant: "destructive",
      });
    }
  };

  const handleEditCustomTool = (toolData: any) => {
    
    const originalToolName = toolData.originalTool?.name || toolData.originalToolName;
    
    const editData = {
      server: toolData.serviceName || toolData.server,
      tool: originalToolName,
      name: toolData.name,
      originalName: toolData.name,
      description: toolData.description?.text || toolData.description || '',
      parameters: toolData.overrideParams ? Object.entries(toolData.overrideParams).map(([name, param]: [string, any]) => ({
        name,
        description: param.description || '',
        value: param.value || ''
      })) : []
    };
    setEditingToolData(editData);
    setEditDialogMode('edit');
    setIsEditCustomToolDialogOpen(true);
  };

  const handleCloseEditCustomToolDialog = () => {
    setIsEditCustomToolDialogOpen(false);
    setEditingToolData(null);
  };

  const handleSaveCustomTool = async (toolData: {
    server: string;
    tool: string;
    name: string;
    originalName?: string;
    description: string;
    parameters: Array<{name: string, description: string, value: string}>;
  }) => {
    if (isSavingCustomTool) return;

    setIsSavingCustomTool(true);
    try {
      const provider = providers.find(p => p.name === toolData.server);
      const originalTool = provider?.originalTools.find((t: any) => t.name === toolData.tool);
      
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
      if (editDialogMode !== 'edit') {
        const serverProvider = providers.find(p => p.name === toolData.server);
        if (serverProvider) {
          const originalToolExists = serverProvider.originalTools.some((tool: any) => 
            tool.name === toolData.name
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

        const existingCustomTools = appConfig?.toolExtensions?.services?.[toolData.server] || {};
        let duplicateCustomTool = null;
        
        for (const [originalToolName, toolExtensions] of Object.entries(existingCustomTools)) {
          const childTools = toolExtensions.childTools || [];
          const found = childTools.find((tool: any) => tool.name === toolData.name);
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
        overrideParams: toolData.parameters.reduce((acc, param) => {
          if (param.value) {
            acc[param.name] = { value: param.value };
          }
          return acc;
        }, {} as Record<string, { value: string }>),
      };

      
      // Use updateCustomTool for edit mode, createCustomTool for duplicate/customize
      let appConfigPayload;
      if (editDialogMode === 'edit') {
        appConfigPayload = updateCustomTool(customTool);
      } else {
        appConfigPayload = createCustomTool(customTool);
      }
      
      const newAppConfig = {
        yaml: YAML.stringify(appConfigPayload),
      };

      await updateAppConfigAsync(newAppConfig);

      const successMessage = editDialogMode === 'edit' 
        ? "Custom tool updated successfully"
        : editDialogMode === 'duplicate'
        ? "Custom tool duplicated successfully"
        : "Custom tool created successfully";

      toast({
        title: "Success",
        description: successMessage,
      });

      handleCloseEditCustomToolDialog();
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
    const provider = providers.find(p => p.name === (toolData.serviceName || toolData.server));
    const originalToolName = toolData.originalTool?.name || toolData.originalToolName;
    const originalTool = provider?.originalTools.find((t: any) => t.name === originalToolName);
    
    
    // Combine original tool parameters with override parameters
    const allParameters: Array<{name: string, description: string, value: string}> = [];
    
    // Add original tool parameters
    if (originalTool?.inputSchema?.properties) {
      Object.entries(originalTool.inputSchema.properties).forEach(([name, param]: [string, any]) => {
        allParameters.push({
          name,
          description: param.description || '',
          value: param.default || ''
        });
      });
    }
    
    // Override with custom tool parameters if they exist
    if (toolData.overrideParams) {
      Object.entries(toolData.overrideParams).forEach(([name, param]: [string, any]) => {
        const existingParamIndex = allParameters.findIndex(p => p.name === name);
        if (existingParamIndex >= 0) {
          // Update existing parameter
          allParameters[existingParamIndex] = {
            name,
            description: param.description || allParameters[existingParamIndex].description,
            value: param.value || ''
          };
        } else {
          // Add new parameter
          allParameters.push({
            name,
            description: param.description || '',
            value: param.value || ''
          });
        }
      });
    }

    // Generate a unique name for the duplicate
    const baseName = toolData.name;
    let duplicateName = `${baseName} (Copy)`;
    let counter = 1;
    
    // Check if the name already exists anywhere in this server and increment counter if needed
    const existingCustomTools = appConfig?.toolExtensions?.services?.[toolData.serviceName || toolData.server] || {};
    
    while (true) {
      let nameExists = false;
      
      // Check all original tools in this server for name conflicts
      for (const [originalToolName, toolExtensions] of Object.entries(existingCustomTools)) {
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
      description: toolData.description?.text || toolData.description || '',
      parameters: allParameters
    };
    
    setEditingToolData(duplicateData);
    setEditDialogMode('duplicate');
    setIsEditCustomToolDialogOpen(true);
  };

  const handleCustomizeToolDialog = (toolData: any) => {
    
    // Generate a unique name for the customize
    const baseName = `Custom ${toolData.name}`;
    let customizeName = baseName;
    let counter = 1;
    
    // Check if the name already exists anywhere in this server and increment counter if needed
    const existingCustomTools = appConfig?.toolExtensions?.services?.[toolData.serviceName || toolData.server] || {};
    
    while (true) {
      let nameExists = false;
      
      // Check all original tools in this server for name conflicts
      for (const [originalToolName, toolExtensions] of Object.entries(existingCustomTools)) {
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

    // Convert tool data to the format expected by EditCustomToolDialog
    const customizeData = {
      server: toolData.serviceName || toolData.server,
      tool: toolData.name, // This should be the original tool name, not the customized name
      name: customizeName,
      description: toolData.description || '',
      parameters: toolData.inputSchema?.properties ? Object.entries(toolData.inputSchema.properties).map(([name, param]: [string, any]) => ({
        name,
        description: param.description || '',
        value: param.default || ''
      })) : []
    };
    setEditingToolData(customizeData);
    setEditDialogMode('customize');
    setIsEditCustomToolDialogOpen(true);
  };

  const handleToolClick = (tool: any) => {
    setSelectedToolForDetails(tool);
    setIsToolDetailsDialogOpen(true);
  };

  // Transform tool groups data for display
  const transformedToolGroups = useMemo(() => {
    if (!toolGroups || toolGroups.length === 0) {
      return [];
    }

    const icons = ['⚙️'];
    
    let groups = toolGroups.map((group, index) => {
      const tools = Object.entries(group.services || {}).map(([serviceName, toolNames]) => ({
        name: serviceName,
        provider: serviceName,
        count: Array.isArray(toolNames) ? toolNames.length : 0,
      }));

      return {
        id: group.id,
        name: group.name,
        description: 'Open new pull request',
        icon: icons[index % icons.length],
        tools: tools,
      };
    });

    if (searchQuery) {
      groups = groups.filter(group => 
        group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        group.tools.some(tool => 
          tool.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }

    return groups;
  }, [toolGroups, searchQuery]);

  const handleGroupNavigation = (direction: 'left' | 'right') => {
    const maxIndex = Math.max(0, Math.ceil(transformedToolGroups.length / 8) - 1);
    if (direction === 'left') {
      setCurrentGroupIndex(Math.max(0, currentGroupIndex - 1));
    } else {
      setCurrentGroupIndex(Math.min(maxIndex, currentGroupIndex + 1));
    }
  };

  const handleGroupClick = (groupId: string) => {
    const toolGroup = transformedToolGroups.find(group => group.id === groupId);
    if (toolGroup) {
      // Find the original group data with services
      const originalGroup = toolGroups.find(group => group.id === groupId);
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
      Object.entries(group.services).forEach(([providerName, toolNames]: [string, any]) => {
        if (toolNames && toolNames.length > 0) {
          providersToExpand.add(providerName);
          toolNames.forEach((toolName: string) => {
            const toolKey = `${providerName}:${toolName}`;
            toolsToSelect.add(toolKey);
          });
        }
      });
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
    if (!confirm(`Are you sure you want to delete the tool group "${group.name}"?`)) {
      return;
    }

    try {
      const updatedGroups = toolGroups.filter(g => g.id !== group.id);
      setToolGroups(updatedGroups);

      // Update app config
      const currentAppConfig = appConfig;
      if (currentAppConfig) {
        const updatedAppConfig = {
          ...currentAppConfig,
          toolGroups: updatedGroups.map(g => ({
            name: g.name,
            services: g.services,
          }))
        };

        await updateAppConfigAsync({
          yaml: YAML.stringify(updatedAppConfig)
        });

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
      selectedTools.forEach(toolKey => {
        const [providerName, toolName] = toolKey.split(':');
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

      const updatedGroups = toolGroups.map(g => 
        g.id === editingGroup.id ? updatedGroup : g
      );
      setToolGroups(updatedGroups);

      // Update app config
      const currentAppConfig = appConfig;
      if (currentAppConfig) {
        const updatedAppConfig = {
          ...currentAppConfig,
          toolGroups: updatedGroups.map(g => ({
            name: g.name,
            services: g.services,
          }))
        };

        await updateAppConfigAsync({
          yaml: YAML.stringify(updatedAppConfig)
        });

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


  const visibleGroups = transformedToolGroups.slice(currentGroupIndex * 8, (currentGroupIndex + 1) * 8);

  return (
    <>
      <div className={styles.container}>
        <div className={styles.content}>
          <div className="mb-6">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold text-gray-900">Tools Catalog</h1>
              {editingGroup && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-[#4F33CC1A] border border-[#4F33CC] rounded-lg">
                  <div className="w-2 h-2 #4F33CC  rounded-full"></div>
                  <span className="text-sm font-medium text-[#4F33CC]">
                    Editing: {editingGroup.name}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Search Bar */}
          <div className="mb-8">
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
          </div>

          <div className="mb-12">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Tools Groups</h2>
            </div>
            
            {transformedToolGroups.length > 0 ? (
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <div className="relative w-full">
                  <div className="flex items-center gap-4 overflow-hidden w-full">
                    {currentGroupIndex > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleGroupNavigation('left')}
                        className="absolute left-0 top-1/2 transform -translate-y-1/2 z-10 bg-white shadow-md"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                    )}
                    
                    <div className="grid grid-cols-4 gap-4 flex-1 w-full">
                      {Array.from({ length: 8 }).map((_, index) => {
                        const group = visibleGroups[index];
                        if (group) {
                          return (
                            <div 
                              key={group.id}
                              className={`rounded-lg border p-6 w-full cursor-pointer transition-colors ${
                                selectedToolGroup === group.id 
                                  ? 'bg-[#4F33CC] border-[#4F33CC] hover:bg-[#4F33CC]' 
                                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                              }`}
                              onClick={() => handleGroupClick(group.id)}
                            >
                              <div className="flex items-center gap-3 mb-3">
                                <span className="text-2xl">{group.icon}</span>
                                <div>
                                  <h3 className="font-semibold text-gray-900 text-sm">{group.name}</h3>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {group.tools.slice(0, 5).map((tool, toolIndex) => (
                                  <div key={toolIndex} className="flex items-center gap-1 bg-white rounded px-2 py-1 text-xs border border-gray-200">
                                    <span className="text-gray-600">{tool.provider}</span>
                                    <span className="bg-gray-100 text-gray-400 rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium">{tool.count}</span>
                                  </div>
                                ))}
                                {group.tools.length > 5 && (
                                  <div className="flex items-center gap-1 bg-white rounded px-2 py-1 text-xs border border-gray-200">
                                    <span className="bg-gray-100 text-gray-400 rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium">+{group.tools.length - 5}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        } else {
                          return (
                            <div key={`empty-${index}`} className="w-full h-[120px]">
                              {/* Empty space */}
                            </div>
                          );
                        }
                      })}
                    </div>

                    {currentGroupIndex < Math.ceil(transformedToolGroups.length / 8) - 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleGroupNavigation('right')}
                        className="absolute right-0 top-1/2 transform -translate-y-1/2 z-10 bg-white shadow-md"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  
                  {/* Pagination dots */}
                  <div className="flex justify-center gap-2 mt-4">
                    {Array.from({ length: Math.ceil(transformedToolGroups.length / 8) }).map((_, index) => (
                      <button
                        key={index}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          index === currentGroupIndex ? 'bg-[#4F33CC]' : 'bg-gray-300'
                        }`}
                        onClick={() => setCurrentGroupIndex(index)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <NoToolGroupsPlaceholder onAction={() => setIsEditMode(true)} />
            )}
          </div>

          <div className={styles.header}>
            <div className={styles.titleSection}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  {selectedToolGroup ? 
                    `Tools from "${toolGroups.find(g => g.id === selectedToolGroup)?.name || 'Selected Group'}"` : 
                    'All Tools Catalog'
                  }
                </h2>
                {selectedToolGroup && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedToolGroup(null)}
                    className="text-gray-600"
                  >
                    Show All Tools
                  </Button>
                )}
              </div>
              {searchQuery && (
                <div className={styles.filterInfo}>
                  <span className={styles.filterBadge}>
                    Filtered: {totalFilteredTools} tool{totalFilteredTools !== 1 ? 's' : ''} found
                  </span>
                  <span className={styles.searchTerm}>Search: "{searchQuery}"</span>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <Button
                onClick={() => setIsCustomToolFullDialogOpen(true)}
                variant="outline"
                className="border-[#4F33CC] text-[#4F33CC] hover:bg-[#4F33CC] px-4 py-2 rounded-lg font-medium transition-colors text-sm"
              >
                Add Custom Tool
              </Button>
              <Button
                onClick={() => {
                  if (isEditMode) {
                    handleCancelGroupEdit();
                  } else {
                    setIsEditMode(true);
                  }
                }}
                className={styles.editModeButton}
              >
                {isEditMode ? 'Cancel' : 'Create Tool Group'}
              </Button>
            </div>

          </div>

        {providers.length === 0 ? (
          !searchQuery ? (
            <NoServersPlaceholder onAction={() => setIsAddServerModalOpen(true)} />
          ) : (
            <NoToolsFoundPlaceholder searchQuery={searchQuery} />
          )
        ) : (
          <div className="space-y-3">
            {providers.map((provider) => (
                      <ProviderCard
                        key={provider.name}
                        provider={provider}
                        isExpanded={expandedProviders.has(provider.name)}
                        isEditMode={isEditMode}
                        selectedTools={selectedTools}
                        onProviderClick={handleProviderClick}
                        onToolSelectionChange={handleToolSelectionChange}
                        handleEditClick={handleEditCustomTool}
                        handleDuplicateClick={handleDuplicateCustomTool}
                        handleDeleteTool={handleDeleteTool}
                        handleCustomizeTool={handleCustomizeToolDialog}
                        onToolClick={handleToolClick}
                      />
            ))}
          </div>
        )}

        {isEditMode && selectedTools.size > 0 && (!editingGroup || !areSetsEqual(selectedTools, originalSelectedTools)) && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50">
            <div className="flex items-center gap-6">
              <div className="flex items-center">
                <div className="flex items-center gap-2">
                  <span className="bg-[#4F33CC] text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium">
                    {selectedTools.size}
                  </span>
                  <span className="text-sm text-gray-700 font-medium">
                    Tool{selectedTools.size !== 1 ? 's' : ''} selected
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {editingGroup ? (
                  <>
                    <Button
                      onClick={handleSaveGroupChanges}
                      disabled={isSavingGroupChanges}
                      className="bg-[#4F33CC] text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm hover:bg-[#4F33CC] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSavingGroupChanges ? "Saving..." : "Save Changes"}
                    </Button>
                    <Button
                      onClick={() => setSelectedTools(new Set())}
                      variant="ghost"
                      className="text-gray-700 px-2 py-2 font-medium transition-colors text-sm hover:bg-gray-50"
                      title="Clear all selected tools"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      onClick={handleCreateToolGroup}
                      className="bg-[#4F33CC] text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm hover:bg-[#4F33CC]"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create
                    </Button>
                    <Button
                      onClick={() => setSelectedTools(new Set())}
                      variant="ghost"
                      className="text-gray-700 px-2 py-2 font-medium transition-colors text-sm hover:bg-gray-50"
                      title="Clear all selected tools"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>

      {/* Create Tool Group Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className={styles.modalContent}>
          <DialogHeader>
            <DialogTitle>Create Tool Group</DialogTitle>
          </DialogHeader>
          <div className={styles.modalSpace}>
            <div className={styles.modalSpace}>
              <label htmlFor="groupName" className={styles.modalLabel}>
                Group Name
              </label>
              <Input
                id="groupName"
                placeholder="Enter tool group name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveToolGroup();
                  }
                }}
                maxLength={120}
                autoFocus
              />
              {newGroupName.length > 100 && (
                <p className={styles.modalCharacterCount}>
                  {newGroupName.length}/120 characters
                </p>
              )}
            </div>
          </div>
          <div className={styles.modalFooter}>
            <Button
              variant="outline"
              onClick={handleCloseCreateModal}
              disabled={isCreating}
              className={styles.modalCancelButton}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveToolGroup}
              className={styles.modalCreateButton}
              disabled={!newGroupName.trim() || isCreating || selectedTools.size === 0}
            >
              {isCreating ? "Creating..." : "Create Group"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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


      {/* Create Custom Tool Dialog */}
      <CustomToolDialog
        isOpen={isCustomToolFullDialogOpen}
        onOpenChange={handleCloseCustomToolFullDialog}
        providers={providers}
        onClose={handleCloseCustomToolFullDialog}
        onCreate={handleCreateCustomTool}
        isLoading={isSavingCustomTool}
      />

      {/* Edit Custom Tool Dialog - Using CustomToolDialog with pre-filled data */}
      {editingToolData && (
        <CustomToolDialog
          isOpen={isEditCustomToolDialogOpen}
          onOpenChange={handleCloseEditCustomToolDialog}
          providers={providers}
          onClose={handleCloseEditCustomToolDialog}
          onCreate={handleSaveCustomTool}
          preSelectedServer={editingToolData.server}
          preSelectedTool={editingToolData.tool}
          preFilledData={{
            name: editingToolData.name,
            description: editingToolData.description,
            parameters: editingToolData.parameters
          }}
          isLoading={isSavingCustomTool}
        />
      )}

      {/* Add Server Modal */}
      {isAddServerModalOpen && (
        <AddServerModal
          onClose={() => setIsAddServerModalOpen(false)}
          onServerAdded={() => {
            setIsAddServerModalOpen(false);
            // Optionally refresh the page or update state
            window.location.reload();
          }}
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
          onEdit={selectedToolForDetails.isCustom ? () => {
            setIsToolDetailsDialogOpen(false);
            handleEditCustomTool(selectedToolForDetails);
          } : undefined}
          onDuplicate={selectedToolForDetails.isCustom ? () => {
            setIsToolDetailsDialogOpen(false);
            handleDuplicateCustomTool(selectedToolForDetails);
          } : undefined}
          onDelete={selectedToolForDetails.isCustom ? () => {
            setIsToolDetailsDialogOpen(false);
            handleDeleteTool(selectedToolForDetails);
          } : undefined}
          onCustomize={!selectedToolForDetails.isCustom ? () => {
            setIsToolDetailsDialogOpen(false);
            handleCustomizeToolDialog(selectedToolForDetails);
          } : undefined}
        />
      )}
    </>
  );
}



const styles = {
  // Container styles
    container: "min-h-screen w-full bg-purple-50 relative",
  content: "container mx-auto py-8 px-4",
  
  // Header styles
  header: "flex justify-between items-start gap-12 whitespace-nowrap mb-0",
  title: "text-3xl font-bold tracking-tight",
  titleSection: "flex flex-col gap-2",
  filterInfo: "flex flex-wrap items-center gap-2 text-sm mb-2",
  filterBadge: "bg-[#4F33CC1A] text-[#4F33CC] px-2 py-1 rounded-full font-medium",
  searchTerm: "bg-gray-200 text-gray-700 px-2 py-1 rounded",
  customToolsFilter: "bg-[#4F33CC1A] text-[#4F33CC] px-2 py-1 rounded-full font-medium",
  editModeButton: " bg-[#4F33CC] text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm",
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
  statusBadgeConnected: "bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium ml-8 mr-2",
  statusBadgePending: "bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-medium ml-12 mr-2",
  statusBadgeFailed: "bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-medium ml-8 mr-2",
  statusBadgeUnauthorized: "bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 ml-8 mr-2",
  statusBadgeIcon: "w-3 h-3",
  
  // Tools container styles
  toolsContainer: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-2",
  toolWrapper: "w-full",
  scrollIndicator: "hidden",
  scrollIcon: "w-5 h-5 text-gray-400",
  noToolsMessage: "col-span-full text-center py-8 text-gray-500 text-sm",
  

  
  // Selection panel styles
  selectionPanel: "fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50",
  selectionPanelContent: "flex items-center gap-6",
  selectionInfo: "flex items-center",
  toolCounter: "flex items-center gap-2",
  toolCounterIcon: "bg-[#4F33CC] text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium",
  toolCounterText: "text-sm text-gray-700 font-medium",
  selectionActions: "flex items-center gap-2",
  createButton: "bg-[#4F33CC] text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm hover:bg-[#4F33CC]",
  removeButton: "border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors text-sm hover:bg-gray-50",
  
  // Modal and form styles
  modalContent: "max-w-md",
  modalSpace: "space-y-4 py-4",
  modalLabel: "text-sm font-medium",
  modalInput: "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
  modalCharacterCount: "text-xs text-gray-500",
  modalFooter: "flex justify-end gap-2",
  modalCancelButton: "px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors",
  modalCreateButton: "px-4 py-2 bg-[#4F33CC] text-white rounded-md text-sm font-medium hover:bg-[#4F33CC] transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
};



