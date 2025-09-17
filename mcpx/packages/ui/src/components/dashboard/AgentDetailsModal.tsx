import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
import { useAccessControlsStore, socketStore } from "@/store";
import { useUpdateAppConfig } from "@/data/app-config";
import { toast } from "@/components/ui/use-toast";
import YAML from "yaml";

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
  } = useAccessControlsStore((s) => ({
    toolGroups: s.toolGroups || [],
    profiles: s.profiles || [],
    setProfiles: s.setProfiles,
    appConfigUpdates: s.appConfigUpdates,
    hasPendingChanges: s.hasPendingChanges,
    resetAppConfigUpdates: s.resetAppConfigUpdates,
  }));

  const { mutateAsync: updateAppConfigAsync } = useUpdateAppConfig();

  const [shouldSaveToBackend, setShouldSaveToBackend] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);

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
      selectedToolGroupIds = toolGroups.map((tg) => tg.id);
    } else {
      selectedToolGroupIds = Array.from(editedToolGroups);
    }

    if (agentProfile) {
      const currentToolGroups = agentProfile.toolGroups || [];
      return !arraysEqual(currentToolGroups, selectedToolGroupIds);
    } else {
      return selectedToolGroupIds.length > 0;
    }
  }, [agent, toolGroups, profiles, allowAll, editedToolGroups]);

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

      const currentSelections = new Set(
        toolGroups
          ?.filter(
            (toolGroup) =>
              agentProfile?.permission === "allow" &&
              agentProfile?.toolGroups?.includes(toolGroup.id),
          )
          .map((toolGroup) => toolGroup.id) || [],
      );

      setAllowAll(false);
      setEditedToolGroups(new Set());
      setOriginalToolGroups(currentSelections);
      setEditedToolGroups(currentSelections);

      if (currentSelections.size === (toolGroups?.length || 0)) {
        setAllowAll(true);
      }

      setIsInitialized(true);
    }
  }, [agent, isInitialized, toolGroups, profiles]);

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
      // When "Allow All" is disabled, keep all individual toggles OFF
      setEditedToolGroups(new Set());
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
      // If "Allow All" is enabled, include all tool groups
      selectedToolGroupIds = currentToolGroups.map((tg) => tg.id);
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
        className="!w-[600px] !max-w-[600px] bg-white p-0 flex flex-col [&>button]:hidden"
      >
        <SheetHeader className="p-4 pb-0">
          <SheetTitle className="flex items-center gap-2 text-lg font-semibold text-gray-800 mt-2 mb-1">
            <Brain className="w-5 h-5 text-purple-600" />
            {agent.identifier || "AI Agent"}
          </SheetTitle>
        </SheetHeader>

        {/* Session Info */}
        <div className="p-4 border-b border-gray-200 flex-shrink-0">
          <SessionIdsTooltip sessionIds={agent.sessionIds} />

          {/* Status Grid */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="grid grid-cols-3 gap-6 text-sm w-full">
              <div className="text-left">
                <div className="text-gray-600 font-medium mb-1">Status</div>
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  {agent.status || "CONNECTED"}
                </Badge>
              </div>
              <div className="text-left">
                <div className="text-gray-600 font-medium mb-1">Calls</div>
                <div className="text-gray-800">
                  {agent.usage?.callCount || 0}
                </div>
              </div>
              <div className="text-left">
                <div className="text-gray-600 font-medium mb-1">Last Call</div>
                <div className="text-gray-800">
                  {agent.usage?.lastCalledAt
                    ? formatDateTime(agent.usage.lastCalledAt)
                    : "N/A"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tool Catalog Section */}
        <div className="px-4 pt-4 pb-0 flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <h3 className="text-lg font-semibold text-gray-800">
              Select Tool Groups
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Allow All Tools</span>
              <Switch
                className="data-[state=checked]:bg-purple-600"
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
                <Card
                  key={group.id}
                  className="border border-gray-200 bg-white"
                >
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
                        className="data-[state=checked]:bg-purple-600"
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
                        <Badge
                          key={index}
                          variant="outline"
                          className="text-sm bg-white border-gray-200"
                        >
                          {mcpName}
                        </Badge>
                      ))}
                      <span className="text-xs text-gray-600 ml-auto">
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
                    <div className="flex justify-start">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-gray-600 hover:text-gray-700 p-1 h-auto"
                        onClick={() => toggleGroupExpansion(group.id)}
                      >
                        {expandedGroups.has(group.id) ? (
                          <>
                            View Less{" "}
                            <ChevronDown className="w-3 h-3 ml-1 rotate-180" />
                          </>
                        ) : (
                          <>
                            View More <ChevronDown className="w-3 h-3 ml-1" />
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-white flex-shrink-0">
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button
              className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
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
