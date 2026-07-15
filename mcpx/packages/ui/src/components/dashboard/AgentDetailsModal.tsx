import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/search-input";
import { Switch } from "@/components/ui/switch";

import ArrowRightIcon from "@/icons/arrow_line_rigth.svg?react";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { VisuallyHidden as VisuallyHiddenPrimitive } from "radix-ui";
const VisuallyHidden = VisuallyHiddenPrimitive.Root;
import { SessionIdsTooltip } from "@/components/ui/SessionIdsTooltip";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Agent } from "@/types";
import { formatDateTime } from "@/utils";
import { ChevronDown, Sparkles, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generatePath, useNavigate } from "react-router-dom";
import { useAccessControlsStore, useSocketStore } from "@/store";
import { apiClient } from "@/lib/api";
import { routes } from "@/routes";
import { useAgentDrawerSkillsData } from "@/data/agent-drawer-skills";
import type { ConsumerConfig } from "@mcpx/shared-model";
import type { AgentProfile, ToolGroup } from "@/store/access-controls";
import { toast } from "@/components/ui/use-toast";
import { getAgentType } from "./helpers";
import { deriveAgentDisplay } from "./agent-display";
import { AgentSkillsSection } from "./AgentSkillsSection";
import { buildAgentDrawerSkills } from "@/mapping/agent-drawer";
import {
  PermissionEntriesByName,
  getTotalConnectedTools,
  getConsumerToolAccess,
} from "@/hooks/toolCount";
import { agentsData } from "./constants";
import {
  isDynamicCapabilitiesEnabled,
  isSkillsPageEnabled,
} from "@/config/runtime-config";
import { DomainBadge } from "./DomainBadge";

function getAgentDrawerPermissionFromConfig(
  entriesByName: PermissionEntriesByName,
  lookupKeys: string[],
  toolGroups: { id: string; name: string }[],
) {
  const fingerprint = JSON.stringify(
    lookupKeys.map((key) => [key, entriesByName?.[key] ?? null]),
  );

  if (!entriesByName || lookupKeys.length === 0) {
    return {
      allowAll: true,
      selectedIds: [] as string[],
      hadConsumerConfig: false,
      fingerprint,
    };
  }

  const groupNames = new Set<string>();
  let allTools = false;
  let emptyAllow = false;
  let hasGroups = false;
  let hadConfig = false;

  for (const key of lookupKeys) {
    const config = entriesByName[key];
    if (config) hadConfig = true;
    const result = getConsumerToolAccess(config);
    if (result.kind === "all") {
      allTools = true;
      break;
    }
    if (result.kind === "none") {
      emptyAllow = true;
      continue;
    }
    result.groupNames.forEach((n) => groupNames.add(n));
    hasGroups = true;
  }

  if (allTools)
    return {
      allowAll: true,
      selectedIds: [] as string[],
      hadConsumerConfig: hadConfig,
      fingerprint,
    };

  if (groupNames.size === 0) {
    const isBlockAll = emptyAllow && !hasGroups;
    return {
      allowAll: !isBlockAll,
      selectedIds: [] as string[],
      hadConsumerConfig: hadConfig,
      fingerprint,
    };
  }

  const selectedIds = toolGroups
    .filter((g) => groupNames.has(g.name))
    .map((g) => g.id);
  return {
    allowAll: false,
    selectedIds,
    hadConsumerConfig: hadConfig,
    fingerprint,
  };
}

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
  const [dynamicCapabilitiesMode, setDynamicCapabilitiesMode] = useState(false);
  const [dynamicCapabilitiesLoading, setDynamicCapabilitiesLoading] =
    useState(false);
  const navigate = useNavigate();
  const skillsPageEnabled = isSkillsPageEnabled();
  const agentDrawerSkillsData = useAgentDrawerSkillsData({
    enabled: isOpen && skillsPageEnabled,
  });

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

  const [internalOpen, setInternalOpen] = useState(false);

  const { systemState, appConfig } = useSocketStore((s) => ({
    systemState: s.systemState,
    appConfig: s.appConfig,
  }));

  // Get consumerTag from x-lunar-consumer-tag header
  const consumerTag = useMemo(() => {
    if (!agent?.sessionIds || agent.sessionIds.length === 0) {
      return null;
    }
    const lastSessionId = agent.sessionIds[agent.sessionIds.length - 1];
    const session = systemState?.connectedClients?.find(
      (client) => client.sessionId === lastSessionId,
    );
    return (
      session?.consumerTag ||
      session?.clientInfo?.name ||
      agent?.identifier ||
      null
    );
  }, [agent?.sessionIds, systemState, agent?.identifier]);

  // Count tools in the dynamic tool group for this consumer
  const dynamicToolsCount = useMemo(() => {
    if (!consumerTag || !toolGroups) return 0;
    const dynamicGroupName = `${consumerTag}_dynamic`;
    const dynamicGroup = toolGroups.find((g) => g.name === dynamicGroupName);
    if (!dynamicGroup) return 0;
    return Object.values(dynamicGroup.services).flat().length;
  }, [consumerTag, toolGroups]);

  const agentType = getAgentType(agent?.identifier, consumerTag);

  const currentAgentData = agentsData[agentType ?? "DEFAULT"];

  // Identity-aware display fields (mirror the agent-node box).
  const display = useMemo(
    () => (agent ? deriveAgentDisplay(agent) : null),
    [agent],
  );

  const agentSkillLinks = useMemo(() => {
    if (!agent) return [];

    return buildAgentDrawerSkills({
      agent,
      enabled: agentDrawerSkillsData.enabledSkills,
      skills: agentDrawerSkillsData.skills,
      systemState,
      catalogItems: agentDrawerSkillsData.catalogItems,
      targetServerAttributes: appConfig?.targetServerAttributes,
      skillHref: (id) => generatePath(routes.skillDetail, { id }),
    });
  }, [
    agent,
    agentDrawerSkillsData.catalogItems,
    agentDrawerSkillsData.enabledSkills,
    agentDrawerSkillsData.skills,
    appConfig?.targetServerAttributes,
    systemState,
  ]);

  // When there are no tool groups in the system, force "Allow All" and clear selections.
  // Do not touch allowAll when tool groups exist: empty selections can mean "block all" (allowAll false).
  useEffect(() => {
    if (!toolGroups || toolGroups.length > 0) return;

    setAllowAll(true);
    setOriginalAllowAll(true);
    setOriginalToolGroups(new Set());
    setEditedToolGroups(new Set());
  }, [toolGroups]);

  // On open: sync internal state, dismiss toasts, fetch dynamic capabilities
  useEffect(() => {
    setInternalOpen(isOpen);
    if (!isOpen) return;

    if (consumerTag) {
      apiClient
        .getDynamicCapabilitiesStatus(consumerTag)
        .then((status) => setDynamicCapabilitiesMode(status.enabled))
        .catch((error) =>
          console.warn("Failed to fetch dynamic capabilities status:", error),
        );
    }
  }, [isOpen, consumerTag]);

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

  // Permission entries for this agent live under either `consumers` or `clientNames`,
  // keyed by the cluster's tag or clientName. Anonymous clusters have no key at all.
  const permissionLookup = useMemo<{
    scope: "consumers" | "clientNames";
    keys: string[];
  } | null>(() => {
    if (!agent) return null;
    switch (agent.identityType) {
      case "consumerTag":
        return { scope: "consumers", keys: [agent.consumerTag] };
      case "clientName":
        return { scope: "clientNames", keys: [agent.clientName] };
      case "anonymous":
        return null;
    }
  }, [agent]);

  const agentToolGroups = useMemo(() => {
    if (!toolGroups || !profiles || !agent?.identifier) return [];

    try {
      const agentProfile = profiles.find(
        (profile) =>
          profile?.name !== "default" &&
          profile?.agents?.some((profileAgent) => {
            return permissionLookup?.keys.includes(profileAgent.name);
          }),
      );

      const activeServerNames = new Set<string>();
      systemState?.targetServers?.forEach((server) => {
        const isInactive =
          appConfig?.targetServerAttributes?.[server.name]?.inactive === true;
        if (!isInactive) activeServerNames.add(server.name);
      });

      const createToolGroup = (toolGroup: ToolGroup, enabled: boolean) => {
        const mcpNames = Object.keys(toolGroup.services || {});
        const activeTools = (
          Object.entries(toolGroup.services || {}) as [string, string[]][]
        )
          .filter(([serverName]) => activeServerNames.has(serverName))
          .flatMap(([, tools]) => tools);
        const uniqueActiveTools = [...new Set(activeTools)];
        const allTools = [
          ...new Set(
            (Object.values(toolGroup.services || {}) as string[][]).flat(),
          ),
        ];
        const activeToolNames = new Set(uniqueActiveTools);

        return {
          id: toolGroup.id,
          title: toolGroup.name,
          description: toolGroup.description || `Tools from ${toolGroup.name}`,
          enabled,
          mcpNames: [...new Set(mcpNames)],
          toolCount: uniqueActiveTools.length,
          totalToolCount: allTools.length,
          allTools: allTools.map((tool) => ({
            name: tool,
            isUnavailable: !activeToolNames.has(tool),
          })),
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
  }, [
    toolGroups,
    profiles,
    agent?.identifier,
    permissionLookup?.keys,
    systemState,
    appConfig,
  ]);

  // Track the last initialization state to detect when we need to re-initialize
  const lastInitializedAgentRef = useRef<string | null>(null);
  const lastInitializedProfilesRef = useRef<string>("");
  const isInitializingRef = useRef(false);
  const justSavedRef = useRef(false);
  const dirtyRef = useRef(false);

  const configPermission = useMemo(
    () =>
      getAgentDrawerPermissionFromConfig(
        permissionLookup
          ? appConfig?.permissions?.[permissionLookup.scope]
          : undefined,
        permissionLookup?.keys ?? [],
        toolGroups,
      ),
    [appConfig?.permissions, permissionLookup, toolGroups],
  );

  // Sync drawer toggles from live appConfig when modal opens or config changes
  useEffect(() => {
    if (!agent || !isOpen || isInitializingRef.current) return;

    if (
      justSavedRef.current &&
      lastInitializedProfilesRef.current === configPermission.fingerprint
    )
      return;
    if (justSavedRef.current) justSavedRef.current = false;

    const agentChanged = lastInitializedAgentRef.current !== agent.identifier;
    const configChanged =
      lastInitializedProfilesRef.current !== configPermission.fingerprint;
    if (!agentChanged && !configChanged) return;

    // Don't clobber in-progress edits from a WebSocket push
    if (!agentChanged && configChanged && dirtyRef.current) return;

    isInitializingRef.current = true;

    setAllowAll(configPermission.allowAll);
    setOriginalAllowAll(configPermission.allowAll);
    setHadOriginalProfile(configPermission.hadConsumerConfig);
    setOriginalToolGroups(new Set(configPermission.selectedIds));
    setEditedToolGroups(new Set(configPermission.selectedIds));

    lastInitializedAgentRef.current = agent.identifier;
    lastInitializedProfilesRef.current = configPermission.fingerprint;
    isInitializingRef.current = false;
    dirtyRef.current = false;
  }, [agent, isOpen, configPermission]);

  // Reset refs when drawer closes so next open always syncs fresh
  useEffect(() => {
    if (!isOpen) {
      lastInitializedAgentRef.current = null;
      lastInitializedProfilesRef.current = "";
      isInitializingRef.current = false;
      justSavedRef.current = false;
      dirtyRef.current = false;
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

  const totalConnectedTools = useMemo(
    () =>
      getTotalConnectedTools(
        systemState?.targetServers,
        appConfig?.targetServerAttributes,
      ),
    [systemState?.targetServers, appConfig?.targetServerAttributes],
  );

  const goToToolCatalog = () => {
    navigate(routes.tools);
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

  const handleDynamicCapabilitiesToggle = async (checked: boolean) => {
    if (!consumerTag) return;

    setDynamicCapabilitiesLoading(true);
    try {
      if (checked) {
        await apiClient.enableDynamicCapabilities(consumerTag);
      } else {
        await apiClient.disableDynamicCapabilities(consumerTag);
      }
      setDynamicCapabilitiesMode(checked);
      toast({
        title: checked
          ? "Dynamic Capabilities Enabled"
          : "Dynamic Capabilities Disabled",
        description: checked
          ? "Tools will be discovered on-demand via natural language"
          : "All configured tools are now visible",
      });
    } catch (error) {
      console.error("Failed to toggle dynamic capabilities:", error);
      toast({
        title: "Error",
        description: "Failed to toggle dynamic capabilities mode",
        variant: "destructive",
      });
    } finally {
      setDynamicCapabilitiesLoading(false);
    }
  };

  const handleAllowAllToggle = (checked: boolean) => {
    dirtyRef.current = true;
    setAllowAll(checked);
    if (checked) {
      setEditedToolGroups(new Set());
    }
  };

  const handleToolGroupToggle = (groupId: string, checked: boolean) => {
    dirtyRef.current = true;
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
    if (!agent) return;

    // Anonymous clusters have neither a tag nor a clientName - nothing to write to.
    if (agent.identityType === "anonymous") {
      toast({
        title: "Cannot save",
        description:
          "This connection has no consumer tag and no client name - no identity to attach permissions to.",
        variant: "destructive",
      });
      return;
    }
    // Derive the single (key) under which this agent's permissions live.
    const targetName: string =
      agent.identityType === "consumerTag"
        ? agent.consumerTag
        : agent.clientName;

    // Permission CRUD adapter - picks consumers-API vs clientNames-API based on the cluster's identity.
    const consumersApi = {
      getAll: () => apiClient.getPermissionConsumers(),
      create: (req: { name: string; config: ConsumerConfig }) =>
        apiClient.createPermissionConsumer(req),
      update: (name: string, config: ConsumerConfig) =>
        apiClient.updatePermissionConsumer(name, config),
      delete: (name: string) => apiClient.deletePermissionConsumer(name),
    };
    const clientNamesApi = {
      getAll: () => apiClient.getPermissionClientNames(),
      create: (req: { name: string; config: ConsumerConfig }) =>
        apiClient.createPermissionClientName(req),
      update: (name: string, config: ConsumerConfig) =>
        apiClient.updatePermissionClientName(name, config),
      delete: (name: string) => apiClient.deletePermissionClientName(name),
    };
    const api =
      agent.identityType === "consumerTag" ? consumersApi : clientNamesApi;

    try {
      // Get current entries from API
      // Use case-insensitive matching to handle name variations
      const currentConsumersResponse: Record<string, ConsumerConfig> = await api
        .getAll()
        .catch(() => ({}));

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
        if (selectedToolGroupNames.length > 0) {
          newConsumerConfig = {
            _type: "default-block",
            consumerGroupKey: `${targetName} Profile`,
            allow: selectedToolGroupNames,
          };
        } else {
          newConsumerConfig = {
            _type: "default-block",
            consumerGroupKey: `${targetName} Profile`,
            allow: [],
          };
        }
      }

      const operations: Array<{
        type: "create" | "update" | "delete";
        name: string;
        config?: ConsumerConfig;
      }> = [];

      const normalizedName = targetName.toLowerCase().trim();
      const originalKey = currentConsumersMap.get(normalizedName);
      const currentConsumer = originalKey
        ? currentConsumersResponse[originalKey]
        : undefined;
      const shouldHaveConsumer = newConsumerConfig !== null;
      const apiConsumerName = originalKey || targetName;

      if (!currentConsumer && shouldHaveConsumer) {
        operations.push({
          type: "create",
          name: targetName,
          config: newConsumerConfig!,
        });
      } else if (currentConsumer && shouldHaveConsumer) {
        operations.push({
          type: "update",
          name: apiConsumerName,
          config: newConsumerConfig!,
        });
      } else if (currentConsumer && !shouldHaveConsumer) {
        operations.push({
          type: "delete",
          name: apiConsumerName,
        });
      }

      await Promise.all(
        operations.map(async (op) => {
          try {
            if (op.type === "create" && op.config) {
              try {
                await api.create({ name: op.name, config: op.config });
              } catch (error) {
                if (error instanceof Error && error.message.includes("409")) {
                  await api.update(op.name, op.config);
                } else {
                  throw error;
                }
              }
            } else if (op.type === "update" && op.config) {
              await api.update(op.name, op.config);
            } else if (op.type === "delete") {
              await api.delete(op.name);
            }
          } catch (error) {
            console.warn(
              `Failed to ${op.type} permission entry ${op.name}:`,
              error,
            );
            throw error;
          }
        }),
      );

      justSavedRef.current = true;
      dirtyRef.current = false;

      // Update local profile state for UI consistency
      const currentProfiles = profiles || [];
      const agentProfile = currentProfiles.find(
        (profile) =>
          profile &&
          profile.name !== "default" &&
          profile.agents &&
          profile.agents.some(
            (profileAgent) => profileAgent.name === targetName,
          ),
      );

      if (agentProfile) {
        if (allowAll) {
          setProfiles(
            (prev) => prev.filter((p) => p.id !== agentProfile.id),
            true,
          );
        } else {
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
        const newProfile: AgentProfile = {
          id: `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: `${targetName} Profile`,
          agents: [
            {
              name: targetName,
              identityType:
                agent.identityType === "consumerTag"
                  ? "consumers"
                  : "clientNames",
            },
          ],
          permission: "allow" as const,
          toolGroups: selectedToolGroupIds,
        };
        setProfiles((prev) => [...prev, newProfile], true);
      }

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
        className="w-[600px]! max-w-[600px]! gap-0 bg-background p-0 text-foreground shadow-xl [&>button]:hidden"
      >
        <SheetHeader className="flex flex-row items-center justify-between gap-2 border-b border-border px-6 py-3">
          <VisuallyHidden>
            <SheetTitle>
              {consumerTag || currentAgentData.name || "AI Agent"} Details
            </SheetTitle>
            <SheetDescription>
              Configure tool access permissions for{" "}
              {consumerTag || currentAgentData.name || "AI Agent"}
            </SheetDescription>
          </VisuallyHidden>
          <div />
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg"
              aria-label="Close agent details"
              onClick={handleClose}
            >
              <ArrowRightIcon />
            </Button>
          </div>
        </SheetHeader>

        <div className="flex shrink-0 flex-col px-6 py-4">
          <div className="flex items-center gap-3">
            <img
              src={display?.icon.src ?? currentAgentData.icon}
              alt={display?.icon.alt ?? `${currentAgentData.name} Agent Avatar`}
              className="size-10 rounded-lg bg-muted/40 ring-1 ring-border"
            />
            <div className="flex min-w-0 flex-col items-start">
              <p className="truncate text-xl font-semibold leading-tight tracking-tight">
                {display?.title || "AI Agent"}
              </p>
              {display?.subtitle &&
                (display.subtitle.extraCount > 0 ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="mt-1 inline-flex max-w-full cursor-help items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {display.subtitle.primary} +
                        {display.subtitle.extraCount}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent
                      side="bottom"
                      align="start"
                      className="flex-col items-start gap-1"
                    >
                      <div className="text-muted-foreground">All clients</div>
                      <div className="space-y-0.5">
                        {display.subtitle.allPrettified.map((name, idx) => (
                          <div key={idx}>{name}</div>
                        ))}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <span className="mt-1 inline-flex max-w-full items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {display.subtitle.primary}
                  </span>
                ))}
            </div>
          </div>
          <SessionIdsTooltip
            sessionIds={agent.sessionIds}
            className="mt-2 text-xs font-medium text-muted-foreground"
          />
        </div>

        <div className="shrink-0 px-6">
          <div className="grid w-full grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl border border-border bg-muted/20 p-3 text-left">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Status
              </div>
              <Badge variant="success" size="sm" className="mt-2">
                {agent.status || "CONNECTED"}
              </Badge>
            </div>
            <div className="rounded-xl border border-border bg-muted/20 p-3 text-left">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Calls
              </div>
              <div className="mt-2 text-sm font-semibold text-foreground">
                {agent.usage?.callCount || 0}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-muted/20 p-3 text-left">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Last Call
              </div>
              <div className="mt-2 text-sm font-semibold text-foreground">
                {agent.usage?.lastCalledAt
                  ? formatDateTime(agent.usage.lastCalledAt)
                  : "N/A"}
              </div>
            </div>
          </div>
        </div>

        {/* Tool Catalog Section */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pt-5">
          {skillsPageEnabled ? (
            <AgentSkillsSection
              skills={agentSkillLinks}
              loading={agentDrawerSkillsData.isLoading}
              error={agentDrawerSkillsData.isError}
            />
          ) : null}

          <Separator className="my-5" />
          <div className="mb-3 text-base font-semibold leading-6 text-foreground">
            Tools Access
          </div>

          {isDynamicCapabilitiesEnabled() && (
            <div className="mb-3 flex shrink-0 items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background text-primary shadow-xs">
                  <Sparkles className="size-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">
                    Dynamic Tools Mode
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Agent discovers tools on-demand
                    {dynamicToolsCount > 0 &&
                      ` (${dynamicToolsCount} tools exposed)`}
                  </p>
                </div>
              </div>
              <Switch
                checked={dynamicCapabilitiesMode}
                onCheckedChange={handleDynamicCapabilitiesToggle}
                disabled={dynamicCapabilitiesLoading || !consumerTag}
              />
            </div>
          )}

          <div className="mb-3 flex shrink-0 items-center justify-between rounded-xl border border-border bg-muted/20 p-3">
            <h3 className="text-sm font-semibold text-foreground">
              All Server Tools ({totalConnectedTools})
            </h3>
            <div className="flex items-center gap-2">
              <Switch
                checked={allowAll}
                onCheckedChange={handleAllowAllToggle}
                disabled={dynamicCapabilitiesMode}
              />
            </div>
          </div>

          {/* Tool Groups List */}
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-xl border border-border bg-muted/20 p-3 pb-4">
            <div className="mb-3 text-sm font-semibold text-foreground">
              Tools
            </div>
            <SearchInput
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              wrapperClassName="mb-3 flex-1 shrink-0"
              className="bg-background"
            />
            {agentToolGroups.length === 0 ? (
              <div className="rounded-lg border border-border bg-background px-4 py-8 text-center">
                <h4 className="mb-2 font-semibold text-foreground">
                  No Tool Groups Defined
                </h4>
                <p className="mb-4 text-sm text-muted-foreground">
                  Create a Tool Group for effective agent control.
                </p>
                <p className="mb-4 text-xs text-muted-foreground">
                  Go to the Tool Catalog area to set this up.
                </p>
                <Button onClick={goToToolCatalog}>
                  Go to Tool Catalog &gt;
                </Button>
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No tool groups found
              </div>
            ) : (
              filteredGroups.map((group) => {
                return (
                  <Card
                    key={group.id}
                    className="cursor-pointer gap-3 rounded-lg border-border bg-background py-3 shadow-xs ring-0 transition-colors hover:border-primary/30 hover:bg-muted/20"
                    onClick={() => toggleGroupExpansion(group.id)}
                  >
                    <CardHeader className="px-3 py-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-1 items-start gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="mt-0.5 size-5 rounded-md p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label={
                              expandedGroups.has(group.id)
                                ? "Collapse tool group"
                                : "Expand tool group"
                            }
                            aria-expanded={expandedGroups.has(group.id)}
                            aria-controls={`agent-tool-group-${group.id}-tools`}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleGroupExpansion(group.id);
                            }}
                          >
                            <ChevronDown
                              className={`size-4 transition-transform ${
                                expandedGroups.has(group.id) ? "rotate-180" : ""
                              }`}
                            />
                          </Button>
                          <div className="min-w-0 flex-1">
                            <CardTitle className="text-sm font-semibold line-clamp-1 cursor-default">
                              {group.title}
                            </CardTitle>
                            <p className="mt-1 line-clamp-2 cursor-default text-xs leading-4 text-muted-foreground">
                              {group.description}
                            </p>
                          </div>
                        </div>
                        <div
                          className="flex h-full gap-2"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <Switch
                            checked={
                              !allowAll && editedToolGroups.has(group.id)
                            }
                            onCheckedChange={(checked: boolean) => {
                              handleToolGroupToggle(group.id, checked);
                            }}
                            disabled={dynamicCapabilitiesMode}
                          />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="px-3 py-0">
                      {/* MCPs and Tool Count */}
                      <div className="flex flex-wrap items-center gap-2">
                        {group.mcpNames.map((mcpName, index) => (
                          <DomainBadge
                            key={index}
                            domain={mcpName}
                            groupId={group.id}
                          />
                        ))}
                        <span className="text-xs text-muted-foreground">
                          {group.totalToolCount !== group.toolCount
                            ? `${group.toolCount}/${group.totalToolCount} tools`
                            : `${group.toolCount} tools`}
                        </span>
                        {group.totalToolCount !== group.toolCount && (
                          <div className="w-full">
                            <span className="flex items-center gap-2 text-xs font-medium leading-5 text-badge-warning-fg">
                              <TriangleAlert
                                aria-hidden="true"
                                className="size-4 shrink-0"
                                strokeWidth={2}
                              />
                              Some servers are currently unavailable
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Expanded Tools View */}
                      {expandedGroups.has(group.id) && (
                        <div
                          id={`agent-tool-group-${group.id}-tools`}
                          className="max-h-64 overflow-y-auto mt-2"
                        >
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            {group.allTools.map((tool, index) => (
                              <Badge
                                key={index}
                                variant="outline"
                                className={
                                  tool.isUnavailable
                                    ? "border-badge-warning-border bg-badge-warning-bg text-badge-warning-fg"
                                    : "border-primary/20 bg-primary/10 text-primary"
                                }
                              >
                                {tool.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* View More/Less Button */}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border bg-background p-4">
          <div className="flex justify-end gap-3">
            <Button
              className="disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
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
