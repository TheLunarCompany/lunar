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
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SessionIdsTooltip } from "@/components/ui/SessionIdsTooltip";
import { Agent } from "@/types";
import { formatDateTime } from "@/utils";
import { Brain, Search, ChevronDown } from "lucide-react";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  useAccessControlsStore,
  socketStore,
  useToolsStore,
  useSocketStore,
} from "@/store";
import { useUpdateAppConfig } from "@/data/app-config";
import { toast } from "@/components/ui/use-toast";
import { getAgentType } from "./helpers";
import { AGENT_TYPES, agentsData } from "./constants";
import { AgentType } from "./types";
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
  const [originalToolGroups, setOriginalToolGroups] = useState<Set<string>>(
    new Set(),
  );
  const [editedToolGroups, setEditedToolGroups] = useState<Set<string>>(
    new Set(),
  );
  const navigate = useNavigate();

  const {
    toolGroups,
    profiles,
    setProfiles,
    appConfigUpdates,
    hasPendingChanges,
    resetAppConfigUpdates,
  } = useAccessControlsStore((s) => {
    return {
      toolGroups: s.toolGroups || [],
      profiles: s.profiles || [],
      setProfiles: s.setProfiles,
      appConfigUpdates: s.appConfigUpdates,
      hasPendingChanges: s.hasPendingChanges,
      resetAppConfigUpdates: s.resetAppConfigUpdates,
    };
  });

  const { mutateAsync: updateAppConfigAsync } = useUpdateAppConfig();

  const [shouldSaveToBackend, setShouldSaveToBackend] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);

  const agentType = getAgentType(agent?.identifier);

  const currentAgentData = agentsData[agentType ?? "DEFAULT"];

  useEffect(() => {
    setInternalOpen(isOpen);
  }, [isOpen]);

  useEffect(() => {
    if (shouldSaveToBackend && appConfigUpdates && hasPendingChanges) {
      saveToBackend();
    }
  }, [shouldSaveToBackend, appConfigUpdates, hasPendingChanges]);

  const saveToBackend = async () => {
    try {
      await updateAppConfigAsync(appConfigUpdates as Record<string, unknown>);
      resetAppConfigUpdates();
      setShouldSaveToBackend(false);

      toast({
        title: "Success",
        description: "Agent profile updated successfully!",
      });
      onClose();
    } catch (error) {
      console.error("Error saving to backend:", error);
      toast({
        title: "Error",
        description: "Failed to save to backend",
        variant: "destructive",
      });
      setShouldSaveToBackend(false);
    }
  };

  const { systemState } = useSocketStore((s) => ({
    systemState: s.systemState,
  }));

  const arraysEqual = (arr1: string[], arr2: string[]) => {
    if (arr1.length !== arr2.length) return false;
    const sorted1 = [...arr1].sort();
    const sorted2 = [...arr2].sort();
    return sorted1.every((val, index) => val === sorted2[index]);
  };

  // Check if there are changes to save
  const hasChanges = useMemo(() => {
    if (!agent || !toolGroups) return false;

    const currentProfiles = profiles || [];
    const { systemState } = socketStore.getState();
    const agentConsumerTags = agent.sessionIds
      .map((sessionId) => {
        const session = systemState?.connectedClients?.find(
          (client) => client.sessionId === sessionId,
        );
        return session?.consumerTag;
      })
      .filter(Boolean) as string[];

    const agentProfile = currentProfiles.find(
      (profile) =>
        profile &&
        profile.name !== "default" &&
        profile.agents &&
        profile.agents.some((profileAgent) =>
          agentConsumerTags.includes(profileAgent),
        ),
    );

    let selectedToolGroupIds: string[];
    if (allowAll) {
      selectedToolGroupIds = [];
    } else {
      selectedToolGroupIds = Array.from(editedToolGroups);
    }

    // Compare with original state instead of current profile
    const originalToolGroupIds = Array.from(originalToolGroups);

    // Check if individual selections changed
    if (!allowAll) {
      return !arraysEqual(originalToolGroupIds, selectedToolGroupIds);
    } else {
      // If allowAll is enabled, check if original had any restrictions
      return originalToolGroupIds.length > 0;
    }
  }, [
    agent,
    toolGroups,
    profiles,
    allowAll,
    editedToolGroups,
    originalToolGroups,
  ]);

  const agentToolGroups = useMemo(() => {
    if (!toolGroups || !profiles || !agent?.identifier) return [];

    try {
      const { systemState } = socketStore.getState();
      const agentConsumerTags = agent.sessionIds
        .map((sessionId) => {
          const session = systemState?.connectedClients?.find(
            (client: any) => client.sessionId === sessionId,
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

      const createToolGroup = (toolGroup: any, enabled: boolean) => {
        const allTools = Object.values(
          toolGroup.services || {},
        ).flat() as string[];
        const mcpNames = Object.keys(toolGroup.services || {});

        return {
          id: toolGroup.id,
          title: toolGroup.name,
          description: `Tools from ${toolGroup.name}`,
          enabled,
          mcpNames: [...new Set(mcpNames)],
          toolCount: [...new Set(allTools)].length,
          allTools: [...new Set(allTools)],
        };
      };

      const isEnabled = (toolGroup: any) =>
        agentProfile?.permission === "allow" &&
        agentProfile?.toolGroups?.includes(toolGroup.id);

      return toolGroups.map((toolGroup) =>
        createToolGroup(toolGroup, isEnabled(toolGroup)),
      );
    } catch (error) {
      return [];
    }
  }, [toolGroups, profiles, agent?.identifier]);

  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (agent && !isInitialized) {
      const { systemState } = socketStore.getState();
      const agentConsumerTags = agent.sessionIds
        .map((sessionId) => {
          const session = systemState?.connectedClients?.find(
            (client: any) => client.sessionId === sessionId,
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

      setAllowAll(!agentProfile);

      const currentSelections = new Set(
        toolGroups
          ?.filter(
            (toolGroup) =>
              agentProfile?.permission === "allow" &&
              agentProfile?.toolGroups?.includes(toolGroup.id),
          )
          .map((toolGroup) => toolGroup.id) || [],
      );

      setOriginalToolGroups(currentSelections);
      setEditedToolGroups(currentSelections);

      setIsInitialized(true);
    }
  }, [agent, isInitialized, toolGroups, profiles]);


  const serverAgent = systemState?.connectedClients.find(
    (client) => client.clientInfo?.name === agent?.identifier,
  );

  useEffect(() => {
    setIsInitialized(false);
  }, [agent]);

  const filteredGroups = agentToolGroups.filter(
    (group) =>
      group &&
      group.title &&
      group.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

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
    // When "Allow All" is enabled, clear individual selections and disable them
    if (checked) {
      setEditedToolGroups(new Set());
    } else {
      // When "Allow All" is disabled, restore the original selections
      setEditedToolGroups(new Set(originalToolGroups));
    }
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

    const currentProfiles = profiles || [];
    const currentToolGroups = toolGroups || [];

    // Find existing profile for this agent - get consumer tags from session IDs
    const { systemState } = socketStore.getState();
    const agentConsumerTags = agent.sessionIds
      .map((sessionId) => {
        const session = systemState?.connectedClients?.find(
          (client) => client.sessionId === sessionId,
        );
        return session?.consumerTag;
      })
      .filter(Boolean) as string[];

    let agentProfile = currentProfiles.find(
      (profile) =>
        profile &&
        profile.name !== "default" &&
        profile.agents &&
        profile.agents.some((profileAgent) =>
          agentConsumerTags.includes(profileAgent),
        ),
    );

    let selectedToolGroupIds: string[];

    if (allowAll) {
      // If "Allow All" is enabled, include no tool groups (all tools allowed)
      selectedToolGroupIds = [];
    } else {
      selectedToolGroupIds = Array.from(editedToolGroups);
    }

    try {
      if (agentProfile) {
        if (selectedToolGroupIds.length === 0) {
          // Delete the existing profile if no groups are selected
          setProfiles((prev) => prev.filter((p) => p.id !== agentProfile.id));
          toast({
            title: "Success",
            description: `Agent profile "${agent.identifier}" deleted successfully!`,
          });
        } else {
          // Update the existing profile with new tool groups
          setProfiles((prev) =>
            prev.map((p) =>
              p.id === agentProfile.id
                ? { ...p, toolGroups: selectedToolGroupIds }
                : p,
            ),
          );
          toast({
            title: "Success",
            description: `Agent profile "${agent.identifier}" updated successfully!`,
          });
        }
      } else {
        // Only create a new profile if there are selected tool groups
        if (selectedToolGroupIds.length > 0) {
          const { systemState } = socketStore.getState();
          const agentConsumerTags = agent.sessionIds
            .map((sessionId) => {
              const session = systemState?.connectedClients?.find(
                (client) => client.sessionId === sessionId,
              );
              return session?.consumerTag;
            })
            .filter(Boolean) as string[];

          const newProfile = {
            id: `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: `${agent.identifier} Profile`,
            agents:
              agentConsumerTags.length > 0
                ? agentConsumerTags
                : [agent.identifier],
            permission: "allow" as const,
            toolGroups: selectedToolGroupIds,
          };

          setProfiles((prev) => [...prev, newProfile]);
          toast({
            title: "Success",
            description: `Agent profile "${agent.identifier}" created successfully!`,
          });
        } else {
          // No profile exists and no groups selected - no action needed
          toast({
            title: "Success",
            description: `No profile changes needed for "${agent.identifier}".`,
          });
        }
      }

      setShouldSaveToBackend(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update agent permissions",
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
    appConfigUpdates,
    hasPendingChanges,
    resetAppConfigUpdates,
    updateAppConfigAsync,
    onClose,
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
    <Sheet open={internalOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent
        side="right"
        className="!w-[600px] gap-0 !max-w-[600px] bg-white p-0 flex flex-col [&>button]:hidden"
      >
        <SheetHeader className="px-6 pt-2 pb-4 flex flex-row justify-between items-center border-b gap-2">
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
                {currentAgentData.name || "AI Agent"}
              </p>
              <p className="text-xs bg-[#F0EEF5] px-1 rounded text-[#7F7999]">
                {serverAgent?.consumerTag || "AI Agent"}
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
              <div className="text-gray-800">{agent.usage?.callCount || 0}</div>
            </div>
            <div className="text-left border border-gray-200 rounded-lg p-4">
              <div className="text-gray-600 font-medium mb-1">Last Call</div>
              <div className="text-gray-800">
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
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <h3 className="text-lg font-semibold text-gray-800">
              Select Tools
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Activate All</span>
              <Switch
                checked={allowAll}
                onCheckedChange={handleAllowAllToggle}
              />
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-4 flex-shrink-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search tool groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Tool Groups List */}
          <div className="space-y-3 flex-1 overflow-y-auto pb-6 min-h-0">
            {filteredGroups.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-semibold text-gray-800 mb-2">
                  No Tool Groups Defined
                </h4>
                <p className="text-gray-600 mb-4">
                  Create a Tool Group for effective agent control.
                </p>
                <p className="text-gray-500 text-sm mb-4">
                  Go to the Tool Catalog area to set this up.
                </p>
                <Button
                  className="bg-purple-600 hover:bg-purple-700"
                  onClick={goToToolCatalog}
                >
                  Go to Tool Catalog &gt;
                </Button>
              </div>
            ) : (
              filteredGroups.map((group) => (
                <Card key={group.id} className="border bg-white">
                  <CardHeader className="p-3 pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-sm font-medium text-gray-800">
                          {group.title}
                        </CardTitle>
                        <p className="text-xs text-gray-600 mt-1">
                          {group.description}
                        </p>
                      </div>
                      <Switch
                        checked={!allowAll && editedToolGroups.has(group.id)}
                        disabled={allowAll}
                        onCheckedChange={(checked) =>
                          handleToolGroupToggle(group.id, checked)
                        }
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    {/* MCPs and Tool Count */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {group.mcpNames.map((mcpName, index) => (
                        <DomainBadge key={index} domain={mcpName} />
                      ))}
                      <span className="text-xs  text-gray-600">
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
                    <div
                      className="flex cursor-pointer items-center font-normal text-[10px]"
                      onClick={() => toggleGroupExpansion(group.id)}
                    >
                      {expandedGroups.has(group.id) ? (
                        <>
                          <span> View Less </span>
                          <ChevronDown className="w-3 h-3 ml-1 rotate-180" />
                        </>
                      ) : (
                        <>
                          <span> View More </span>
                          <ChevronDown className="w-3 h-3 ml-1" />
                        </>
                      )}
                    </div>
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

export const DomainBadge = ({ domain }: { domain: string }) => {
  const { systemState, appConfig } = useSocketStore((s) => ({
    systemState: s.systemState,
    appConfig: s.appConfig,
  }));

  const server = systemState?.targetServers_new?.find(
    (server) => server.name === domain,
  );

  const domainIconUrl = useDomainIcon(domain);

  return (
    <Badge variant="outline" className="text-sm bg-white p-1 border-gray-200">
      {domainIconUrl ? (
        <img src={domainIconUrl} alt="Domain Icon" className="w-4 h-4" />
      ) : (
        <McpIcon style={{ color: server?.icon }} className="w-4 h-4" />
      )}
    </Badge>
  );
};
