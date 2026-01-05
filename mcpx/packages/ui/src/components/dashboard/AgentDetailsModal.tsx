import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import McpIcon from "./SystemConnectivity/nodes/Mcpx_Icon.svg?react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

import ArrowRightIcon from "@/icons/arrow_line_rigth.svg?react";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  VisuallyHidden,
} from "@/components/ui/sheet";
import { SessionIdsTooltip } from "@/components/ui/SessionIdsTooltip";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Agent } from "@/types";
import { formatDateTime } from "@/utils";
import { ChevronDown, ListFilter, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { socketStore, useAccessControlsStore, useSocketStore } from "@/store";
import { apiClient } from "@/lib/api";
import type { ConsumerConfig, ConnectedClient } from "@mcpx/shared-model";
import type { ToolGroup } from "@/store/access-controls";
import { toast, useToast } from "@/components/ui/use-toast";
import { getAgentType } from "./helpers";
import { agentsData } from "./constants";
import { useDomainIcon } from "@/hooks/useDomainIcon";

interface AgentDetailsModalProps {
  agent: Agent | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AgentDetailsModal = ({
  agent,
  isOpen,
  onClose,
}: AgentDetailsModalProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [allowAll, setAllowAll] = useState(false);
  const [originalAllowAll, setOriginalAllowAll] = useState(false);
  const [originalToolGroups, setOriginalToolGroups] = useState<Set<string>>(
    new Set(),
  );
  const [hadOriginalProfile, setHadOriginalProfile] = useState(false);
  const [editedToolGroups, setEditedToolGroups] = useState<Set<string>>(
    new Set(),
  );
  const navigate = useNavigate();

  const { toolGroups, profiles, setProfiles } = useAccessControlsStore((s) => {
    return {
      toolGroups: s.toolGroups || [],
      profiles: s.profiles || [],
      setProfiles: s.setProfiles,
      setAppConfigUpdates: s.setAppConfigUpdates,
      appConfigUpdates: s.appConfigUpdates,
      hasPendingChanges: s.hasPendingChanges,
      resetAppConfigUpdates: s.resetAppConfigUpdates,
    };
  });

  const { dismiss } = useToast();

  const [internalOpen, setInternalOpen] = useState(false);

  const { systemState } = useSocketStore((s) => ({
    systemState: s.systemState,
  }));

  // Get consumerTag from x-lunar-consumer-tag header
  const consumerTag = useMemo(() => {
    if (!agent?.sessionIds || agent.sessionIds.length === 0) {
      return null;
    }
    const session = systemState?.connectedClients?.find(
      (client) => client.sessionId === agent.sessionIds[0],
    );
    return session?.consumerTag || null;
  }, [agent?.sessionIds, systemState]);

  const agentType = getAgentType(agent?.identifier, consumerTag);

  const currentAgentData = agentsData[agentType ?? "DEFAULT"];

  useEffect(() => {
    // If there are no tool groups, automatically enable "All Server Tools"
    if (!toolGroups || toolGroups.length === 0) {
      setAllowAll(true);
      // Update originalAllowAll if tool groups were deleted while drawer is open
      // This ensures the save button works correctly when toggling the switch
      if (originalToolGroups.size > 0) {
        // Tool groups were deleted, so update original state
        setOriginalAllowAll(true);
        setOriginalToolGroups(new Set());
        setEditedToolGroups(new Set());
      }
    } else if (editedToolGroups.size === 0) {
      setAllowAll(editedToolGroups.size === 0);
    }
  }, [editedToolGroups.size, toolGroups, originalToolGroups.size]);

  useEffect(() => {
    if (isOpen) {
      // Only dismiss toasts when opening if we haven't just saved
      // This prevents dismissing the success toast that was just shown
      if (!justSavedRef.current) {
        dismiss(); // Dismiss all toasts when opening Agent Details modal
      }
    }
    setInternalOpen(isOpen);
  }, [isOpen, dismiss]);

  const arraysEqual = (arr1: string[], arr2: string[]) => {
    if (arr1.length !== arr2.length) return false;
    const sorted1 = [...arr1].sort();
    const sorted2 = [...arr2].sort();
    return sorted1.every((val, index) => val === sorted2[index]);
  };

  // Check if there are changes to save
  const hasChanges = useMemo(() => {
    if (!agent || !toolGroups) return false;

    let selectedToolGroupIds: string[];
    if (allowAll) {
      selectedToolGroupIds = [];
    } else {
      selectedToolGroupIds = Array.from(editedToolGroups);
    }

    // Compare with original state instead of current profile
    const originalToolGroupIds = Array.from(originalToolGroups);

    // Check if allowAll state changed
    const allowAllChanged = allowAll !== originalAllowAll;

    // Check if individual selections changed
    let hasChangesResult = false;
    if (!allowAll) {
      hasChangesResult = !arraysEqual(
        originalToolGroupIds,
        selectedToolGroupIds,
      );
    } else {
      // If allowAll is enabled, check if original had any restrictions
      // OR if there was originally a profile that needs to be deleted
      hasChangesResult = originalToolGroupIds.length > 0 || hadOriginalProfile;
    }

    // Return true if either allowAll changed or tool group selections changed
    return allowAllChanged || hasChangesResult;
  }, [
    agent,
    toolGroups,
    allowAll,
    originalAllowAll,
    editedToolGroups,
    originalToolGroups,
    hadOriginalProfile,
  ]);

  const agentToolGroups = useMemo(() => {
    if (!toolGroups || !profiles || !agent?.identifier) return [];

    try {
      const { systemState } = socketStore.getState();
      const agentConsumerTags = agent.sessionIds
        .map((sessionId) => {
          const session = systemState?.connectedClients?.find(
            (client: ConnectedClient) => client.sessionId === sessionId,
          );
          return session?.consumerTag;
        })
        .filter(Boolean) as string[];

      const agentProfile = profiles.find(
        (profile) =>
          profile?.name !== "default" &&
          profile?.agents?.some((profileAgent) =>
            agentConsumerTags.includes(profileAgent),
          ),
      );

      const createToolGroup = (toolGroup: ToolGroup, enabled: boolean) => {
        const allTools = Object.values(
          toolGroup.services || {},
        ).flat() as string[];
        const mcpNames = Object.keys(toolGroup.services || {});

        return {
          id: toolGroup.id,
          title: toolGroup.name,
          description: toolGroup.description || `Tools from ${toolGroup.name}`,
          enabled,
          mcpNames: [...new Set(mcpNames)],
          toolCount: [...new Set(allTools)].length,
          allTools: [...new Set(allTools)],
        };
      };

      const isEnabled = (toolGroup: ToolGroup) =>
        agentProfile?.permission === "allow" &&
        (agentProfile?.toolGroups?.includes(toolGroup.id) ||
          agentProfile?.toolGroups?.includes(toolGroup.name));

      return toolGroups.map((toolGroup) =>
        createToolGroup(toolGroup, isEnabled(toolGroup)),
      );
    } catch (_error) {
      return [];
    }
  }, [toolGroups, profiles, agent?.identifier, agent?.sessionIds]);

  // Track the last initialization state to detect when we need to re-initialize
  const lastInitializedAgentRef = useRef<string | null>(null);
  const lastInitializedProfilesRef = useRef<string>("");
  const isInitializingRef = useRef(false);
  const justSavedRef = useRef(false);

  useEffect(() => {
    if (!agent || !isOpen || isInitializingRef.current) return;

    const { systemState } = socketStore.getState();
    const agentConsumerTags = agent.sessionIds
      .map((sessionId) => {
        const session = systemState?.connectedClients?.find(
          (client: ConnectedClient) => client.sessionId === sessionId,
        );
        return session?.consumerTag;
      })
      .filter(Boolean) as string[];

    const agentProfile = profiles?.find(
      (p) =>
        p?.name !== "default" &&
        p?.agents?.some((profileAgent) =>
          agentConsumerTags.includes(profileAgent),
        ),
    );

    // Create a hash of the current profile state to detect changes
    const currentProfileHash = JSON.stringify({
      hasProfile: !!agentProfile,
      toolGroups: agentProfile?.toolGroups || [],
      permission: agentProfile?.permission,
    });

    // Prevent re-initialization immediately after save to avoid race conditions
    if (justSavedRef.current) {
      if (lastInitializedProfilesRef.current !== currentProfileHash) {
        justSavedRef.current = false;
      } else {
        return;
      }
    }

    // Re-initialize if:
    // 1. Agent changed, OR
    // 2. Modal just opened (agent identifier doesn't match or was reset), OR
    // 3. Profile state changed (profile hash doesn't match)
    const agentChanged = lastInitializedAgentRef.current !== agent.identifier;
    const profileStateChanged =
      lastInitializedProfilesRef.current !== currentProfileHash;
    const shouldInitialize = agentChanged || profileStateChanged;

    if (shouldInitialize) {
      isInitializingRef.current = true;

      // Determine initial allowAll state:
      // - If no profile exists: allowAll = true (no restrictions, all tools allowed)
      // - If profile exists with empty toolGroups: allowAll = false (user explicitly disabled "All Server Tools")
      // - If profile exists with toolGroups: allowAll = false (has specific tool group restrictions)
      let initialAllowAll: boolean;

      if (!agentProfile) {
        // No profile exists - allow all tools (no restrictions)
        initialAllowAll = true;
      } else {
        // Profile exists - check if it has tool groups
        const profileToolGroups = agentProfile.toolGroups || [];
        if (profileToolGroups.length === 0) {
          // Empty toolGroups array means user explicitly disabled "All Server Tools"
          // This happens when user toggles from enable to disable with no tool groups
          initialAllowAll = false;
        } else {
          // Has tool groups - not allowing all (has specific restrictions)
          initialAllowAll = false;
        }
      }

      setAllowAll(initialAllowAll);
      setOriginalAllowAll(initialAllowAll);
      setHadOriginalProfile(!!agentProfile);

      const matchedToolGroups: string[] = [];

      toolGroups?.forEach((toolGroup) => {
        if (agentProfile?.permission !== "allow") return;

        const matchedById = agentProfile.toolGroups?.includes(toolGroup.id);
        const matchedByName = agentProfile.toolGroups?.includes(toolGroup.name);

        if (matchedById || matchedByName) {
          matchedToolGroups.push(toolGroup.id);
        }
      });

      const currentSelections = new Set(matchedToolGroups);

      setOriginalToolGroups(currentSelections);
      setEditedToolGroups(currentSelections);

      // Track what we initialized for
      lastInitializedAgentRef.current = agent.identifier;
      lastInitializedProfilesRef.current = currentProfileHash;

      isInitializingRef.current = false;
    }
  }, [agent, isOpen, toolGroups, profiles]);

  // Reset the refs when drawer closes so state reloads on next open
  // This ensures that when the modal reopens, it will always re-initialize with fresh data
  useEffect(() => {
    if (!isOpen) {
      lastInitializedAgentRef.current = null;
      lastInitializedProfilesRef.current = "";
      isInitializingRef.current = false;
      justSavedRef.current = false;
    }
  }, [isOpen]);

  const filteredGroups = agentToolGroups.filter(
    (group) =>
      group &&
      group.title &&
      (group.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        group.mcpNames.some((mcpName) =>
          mcpName.toLowerCase().includes(searchQuery.toLowerCase()),
        )),
  );

  // Calculate total connected tools from all servers (same as dashboard top left card)
  const totalConnectedTools = useMemo(() => {
    if (!systemState?.targetServers_new) return 0;
    return systemState.targetServers_new.reduce(
      (total, server) => total + (server.tools?.length || 0),
      0,
    );
  }, [systemState?.targetServers_new]);

  const goToToolCatalog = () => {
    navigate("/tools");
    onClose();
  };

  const toggleGroupExpansion = (groupId: string) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const handleAllowAllToggle = (checked: boolean) => {
    setAllowAll(checked);
    // When "Allow All" is enabled, clear individual selections
    if (checked) {
      setEditedToolGroups(new Set());
    }
    // When "Allow All" is disabled, keep current selections
    // This allows user to work with individual tool groups without losing their selections
  };

  const handleToolGroupToggle = (groupId: string, checked: boolean) => {
    // Turn off "Allow All" when individual groups are toggled
    setAllowAll(false);

    setEditedToolGroups((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(groupId);
      } else {
        newSet.delete(groupId);
      }
      return newSet;
    });
  };

  const saveConfiguration = useCallback(async () => {
    if (!agent?.identifier) {
      toast({
        title: "Error",
        description: "Agent identifier is missing",
        variant: "destructive",
      });
      return;
    }

    try {
      const { systemState } = socketStore.getState();
      const agentConsumerTags = agent.sessionIds
        .map((sessionId) => {
          const session = systemState?.connectedClients?.find(
            (client) => client.sessionId === sessionId,
          );
          return session?.consumerTag;
        })
        .filter(Boolean) as string[];

      // Use consumer tags if available, otherwise fall back to agent identifier
      const consumersToProcess: string[] =
        agentConsumerTags.length > 0
          ? agentConsumerTags
          : agent.identifier
            ? [agent.identifier]
            : [];

      // Get current consumers from API
      // Use case-insensitive matching to handle consumer name variations
      const currentConsumersResponse: Record<string, ConsumerConfig> =
        await apiClient.getPermissionConsumers().catch(() => ({}));

      const currentConsumersMap = new Map<string, string>();
      for (const key of Object.keys(currentConsumersResponse)) {
        currentConsumersMap.set(key.toLowerCase().trim(), key);
      }

      // Determine selected tool group IDs
      const selectedToolGroupIds = allowAll ? [] : Array.from(editedToolGroups);

      // Convert tool group IDs to names for ConsumerConfig
      const selectedToolGroupNames = selectedToolGroupIds
        .map((id) => toolGroups.find((g) => g.id === id)?.name)
        .filter(Boolean) as string[];

      // Build ConsumerConfig based on state
      let newConsumerConfig: ConsumerConfig | null = null;

      if (!allowAll) {
        // If allowAll is false, create a profile with restrictions
        if (selectedToolGroupNames.length > 0) {
          // Has specific tool groups - default-block with allow list
          newConsumerConfig = {
            _type: "default-block",
            consumerGroupKey: `${agent.identifier} Profile`,
            allow: selectedToolGroupNames,
          };
        } else {
          // No tool groups selected but allowAll is false - block all
          newConsumerConfig = {
            _type: "default-block",
            consumerGroupKey: `${agent.identifier} Profile`,
            allow: [],
          };
        }
      }
      // If allowAll is true, newConsumerConfig remains null (will delete if exists)

      // Process each consumer tag (or agent identifier if no tags)
      const operations: Array<{
        type: "create" | "update" | "delete";
        name: string;
        config?: ConsumerConfig;
      }> = [];

      for (const consumerName of consumersToProcess) {
        const normalizedName = consumerName.toLowerCase().trim();
        const originalKey = currentConsumersMap.get(normalizedName);
        const currentConsumer = originalKey
          ? currentConsumersResponse[originalKey]
          : undefined;
        const shouldHaveConsumer = newConsumerConfig !== null;
        const apiConsumerName = originalKey || consumerName;

        if (!currentConsumer && shouldHaveConsumer) {
          // Create new consumer
          operations.push({
            type: "create",
            name: consumerName,
            config: newConsumerConfig!,
          });
        } else if (currentConsumer && shouldHaveConsumer) {
          // Update existing consumer
          operations.push({
            type: "update",
            name: apiConsumerName,
            config: newConsumerConfig!,
          });
        } else if (currentConsumer && !shouldHaveConsumer) {
          // Delete existing consumer (allowAll is true, should fall back to default)
          operations.push({
            type: "delete",
            name: apiConsumerName,
          });
        }
        // If !currentConsumer && !shouldHaveConsumer, no action needed
      }

      // Execute all operations
      await Promise.all(
        operations.map(async (op) => {
          try {
            if (op.type === "create" && op.config) {
              try {
                await apiClient.createPermissionConsumer({
                  name: op.name,
                  config: op.config,
                });
              } catch (error) {
                // Handle 409 conflict: consumer already exists, update instead
                if (error instanceof Error && error.message.includes("409")) {
                  await apiClient.updatePermissionConsumer(op.name, op.config);
                } else {
                  throw error;
                }
              }
            } else if (op.type === "update" && op.config) {
              await apiClient.updatePermissionConsumer(op.name, op.config);
            } else if (op.type === "delete") {
              await apiClient.deletePermissionConsumer(op.name);
            }
          } catch (error) {
            console.warn(`Failed to ${op.type} consumer ${op.name}:`, error);
            throw error;
          }
        }),
      );

      justSavedRef.current = true;

      // Update local profile state for UI consistency
      const currentProfiles = profiles || [];
      const agentProfile = currentProfiles.find(
        (profile) =>
          profile &&
          profile.name !== "default" &&
          profile.agents &&
          profile.agents.some((profileAgent) =>
            consumersToProcess.includes(profileAgent),
          ),
      );

      if (agentProfile) {
        if (allowAll) {
          // Delete profile if allowAll is enabled
          setProfiles(
            (prev) => prev.filter((p) => p.id !== agentProfile.id),
            true,
          );
        } else {
          // Update profile with new tool groups
          setProfiles(
            (prev) =>
              prev.map((p) =>
                p.id === agentProfile.id
                  ? {
                      ...p,
                      toolGroups: selectedToolGroupIds,
                      permission: "allow" as const,
                    }
                  : p,
              ),
            true,
          );
        }
      } else if (!allowAll) {
        // Create new profile if it doesn't exist and allowAll is false
        const newProfile = {
          id: `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: `${agent.identifier} Profile`,
          agents: consumersToProcess,
          permission: "allow" as const,
          toolGroups: selectedToolGroupIds,
        };
        setProfiles((prev) => [...prev, newProfile], true);
      }

      // Show toast first
      toast({
        title: "AI Agent Edited",
        description: (
          <>
            <strong>
              {currentAgentData.name.charAt(0).toUpperCase() +
                currentAgentData.name.slice(1)}
            </strong>{" "}
            agent profile was updated successfully
          </>
        ),
      });

      // Close drawer after a brief delay to allow toast to be visible
      setTimeout(() => {
        justSavedRef.current = false;
        onClose();
      }, 500);
    } catch (error) {
      console.error("Error saving to backend:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to save agent permissions",
        variant: "destructive",
      });
    }
  }, [
    agent,
    profiles,
    toolGroups,
    setProfiles,
    allowAll,
    editedToolGroups,
    onClose,
    currentAgentData.name,
  ]);

  const handleClose = () => {
    setInternalOpen(false);
    setTimeout(() => onClose(), 300); // Allow animation to complete
  };

  if (!isOpen || !agent) return null;

  if (!agent.sessionIds || agent.sessionIds.length === 0) {
    return null;
  }

  return (
    <Sheet
      open={internalOpen}
      onOpenChange={(open: boolean) => !open && handleClose()}
    >
      <SheetContent
        side="right"
        className="!w-[600px] gap-0 !max-w-[600px] bg-white p-0 flex flex-col [&>button]:hidden"
      >
        <SheetHeader className="px-6 pt-2 pb-4 flex flex-row justify-between items-center border-b gap-2">
          <VisuallyHidden>
            <SheetTitle>
              {consumerTag || currentAgentData.name || "AI Agent"} Details
            </SheetTitle>
            <SheetDescription>
              Configure tool access permissions for{" "}
              {consumerTag || currentAgentData.name || "AI Agent"}
            </SheetDescription>
          </VisuallyHidden>
          <div></div>
          <div className="flex mt-0 gap-1.5 items-center text-[#7F7999]">
            <Button
              variant="ghost"
              size="icon"
              className="w-4 h-4"
              onClick={handleClose}
            >
              <ArrowRightIcon />
            </Button>
          </div>
        </SheetHeader>

        <div className="px-6 py-2  flex flex-col overflow-y-auto">
          <div className="flex items-center gap-2 text-lg font-semibold  mt-2 mb-1">
            <img
              src={currentAgentData.icon}
              alt={`${currentAgentData.name} Agent Avatar`}
              className="w-12 h-12 rounded-md"
            />
            <div className="flex flex-col items-start ">
              <p className="text-2xl font-medium capitalize">
                {consumerTag || currentAgentData.name || "AI Agent"}
              </p>
              <p className="text-xs bg-[#F0EEF5] px-1 rounded text-[#7F7999]">
                {consumerTag || "AI Agent"}
              </p>
            </div>
          </div>
          <SessionIdsTooltip
            sessionIds={agent.sessionIds}
            className="text-[#7F7999] font-medium text-sm"
          />
        </div>

        <div className="px-6">
          <div className="grid grid-cols-3 gap-6 text-sm w-full">
            <div className="text-left border  rounded-lg p-4">
              <div className="text-gray-600 font-medium mb-1">Status</div>
              <Badge className="bg-green-100 text-green-800 border-green-200">
                {agent.status || "CONNECTED"}
              </Badge>
            </div>
            <div className="text-left border border-gray-200 rounded-lg p-4">
              <div className="text-gray-600 font-medium mb-1">Calls</div>
              <div className="">{agent.usage?.callCount || 0}</div>
            </div>
            <div className="text-left border border-gray-200 rounded-lg p-4">
              <div className="text-gray-600 font-medium mb-1">Last Call</div>
              <div className="">
                {agent.usage?.lastCalledAt
                  ? formatDateTime(agent.usage.lastCalledAt)
                  : "N/A"}
              </div>
            </div>
          </div>
        </div>

        {/* Tool Catalog Section */}
        <div className="px-6 flex-1 flex flex-col overflow-hidden">
          <Separator className="my-4" />
          <div className="text-lg font-semibold mb-2">Tools Access</div>

          <div className="flex items-center border rounded-lg p-4 justify-between mb-4 flex-shrink-0">
            <h3 className="text-sm font-semibold ">
              All Server Tools ({totalConnectedTools})
            </h3>
            <div className="flex items-center gap-2">
              <Switch
                checked={allowAll}
                onCheckedChange={handleAllowAllToggle}
              />
            </div>
          </div>

          {/* Search */}

          {/* Tool Groups List */}
          <div className="space-y-3 overflow-y-auto pb-6 mb-4  border  rounded-lg p-4">
            <div className="text-lg font-bold  mb-2">Tools </div>
            <div className="flex gap-4 items-center">
              <div className="relative flex-1 flex-shrink-0">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 border! bg-[#FBFBFF]"
                />
              </div>
              <div className="flex items-center text-[#7F7999] gap-2">
                <ListFilter className="w-4 h-4" />
                Filter
              </div>
            </div>
            {filteredGroups.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-semibold  mb-2">No Tool Groups Defined</h4>
                <p className="text-gray-600 mb-4">
                  Create a Tool Group for effective agent control.
                </p>
                <p className="text-gray-500 text-sm mb-4">
                  Go to the Tool Catalog area to set this up.
                </p>
                <Button onClick={goToToolCatalog}>
                  Go to Tool Catalog &gt;
                </Button>
              </div>
            ) : (
              filteredGroups.map((group) => (
                <Card key={group.id} className="border bg-white">
                  <CardHeader className="p-3 pb-2">
                    <div className="flex justify-between">
                      <div className="flex-1 max-w-[60%]">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <CardTitle className="text-sm font-semibold line-clamp-1 cursor-default">
                                {group.title}
                              </CardTitle>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">{group.title}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-[10px] font-regular mt-1 line-clamp-2 cursor-default">
                                {group.description}
                              </p>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">{group.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="flex h-full gap-2">
                        <div
                          className="flex cursor-pointer items-center font-normal text-[10px] whitespace-nowrap"
                          onClick={() => toggleGroupExpansion(group.id)}
                        >
                          {expandedGroups.has(group.id) ? (
                            <>
                              <span>View Less</span>
                              <ChevronDown className="w-3 h-3 ml-1 rotate-180" />
                            </>
                          ) : (
                            <>
                              <span>View More</span>
                              <ChevronDown className="w-3 h-3 ml-1" />
                            </>
                          )}
                        </div>
                        <Switch
                          checked={!allowAll && editedToolGroups.has(group.id)}
                          onCheckedChange={(checked: boolean) => {
                            handleToolGroupToggle(group.id, checked);
                          }}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    {/* MCPs and Tool Count */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {group.mcpNames.map((mcpName, index) => (
                        <DomainBadge
                          key={index}
                          domain={mcpName}
                          groupId={group.id}
                        />
                      ))}
                      <span className="text-xs  text-[#7F7999]">
                        {group.toolCount} tools
                      </span>
                    </div>

                    {/* Expanded Tools View */}
                    {expandedGroups.has(group.id) && (
                      <div className="max-h-64 overflow-y-auto rounded-md p-3">
                        <div className="flex items-center mb-2 flex-wrap gap-2">
                          {group.allTools.map((tool, index) => (
                            <Badge
                              key={index}
                              variant="outline"
                              className="text-xs bg-gray-100 rounded-none"
                            >
                              {tool}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* View More/Less Button */}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-white flex-shrink-0">
          <div className="flex gap-3 justify-end">
            <Button
              className=" disabled:bg-gray-400 disabled:cursor-not-allowed"
              onClick={saveConfiguration}
              disabled={!hasChanges}
            >
              Save
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export const DomainBadge = ({
  domain,
  groupId,
}: {
  domain: string;
  groupId: string;
}) => {
  const { systemState } = useSocketStore((s) => ({
    systemState: s.systemState,
    appConfig: s.appConfig,
  }));

  const { toolGroups } = useAccessControlsStore((s) => {
    return {
      toolGroups: s.toolGroups || [],
    };
  });

  const toolGroup = toolGroups.find((group) => group.id === groupId);

  const server = systemState?.targetServers_new?.find(
    (server) => server.name === domain,
  );

  const domainIconUrl = useDomainIcon(domain);

  const toolsNumber = toolGroup?.services[domain]?.length;

  return (
    <Badge
      variant="outline"
      className="text-sm flex gap-1 items-center bg-white px-2 py-1 border"
    >
      {domainIconUrl ? (
        <img src={domainIconUrl} alt="Domain Icon" className="w-4 h-4" />
      ) : (
        <McpIcon style={{ color: server?.icon }} className="w-4 h-4" />
      )}
      <span className="text-[10px] capitalize font-normal text-foreground ">
        {domain}
      </span>
      <span className="text-[10px] bg-[#F9F8FB] rounded-full w-[16px] h-[16px] flex items-center justify-center font-normal text-[#7F7999]">
        {toolsNumber}
      </span>
    </Badge>
  );
};
