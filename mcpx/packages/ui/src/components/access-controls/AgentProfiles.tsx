import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AgentProfile, DEFAULT_PROFILE_NAME, ToolGroup } from "@/store";
import sortBy from "lodash/sortBy";
import { CopyPlus, Info, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { MultiSelect } from "./MultiSelect";
import { MultiSelectTools } from "./MultiSelectTools";
import { ToolGroupModal } from "./ToolGroupModal";

const AgentProfileRow = ({
  agentsOptions,
  isDefaultProfile = false,
  isPendingUpdateAppConfig,
  handleProfileChange,
  onCreateNewAgent,
  onCreateNewToolGroup,
  onDuplicateProfile,
  onRemoveProfile,
  profile,
  toolGroups,
}: {
  agentsOptions: { label: string; value: string; disabled?: boolean }[];
  isDefaultProfile?: boolean;
  isPendingUpdateAppConfig: boolean;
  handleProfileChange: (
    id: string,
    field: keyof AgentProfile,
    value: AgentProfile[keyof AgentProfile],
  ) => void;
  onCreateNewAgent: (newAgentName: string) => void;
  onCreateNewToolGroup: () => void;
  onDuplicateProfile: (profileId: string) => void;
  onRemoveProfile: (profileId: string) => void;
  profile: AgentProfile;
  toolGroups: ToolGroup[];
}) => {
  const [focused, setFocused] = useState(false);
  const handleFocus = () => setFocused(true);
  const handleBlur = () => setFocused(false);
  const shouldAutoFocus = focused && !isDefaultProfile;
  const enableRemoveButton = !isDefaultProfile;
  const enableDuplicateButton = !isDefaultProfile && profile.name !== "";

  if (!profile) {
    return null;
  }

  const handleAgentsChange = (agent: string) => {
    const currentAgents = profile.agents || [];
    const newAgents = currentAgents.includes(agent)
      ? currentAgents.filter((a) => a !== agent)
      : [...currentAgents, agent];
    handleProfileChange(
      profile.id,
      "agents",
      sortBy(newAgents, (a) => a.toLowerCase()),
    );
  };

  const handleToolGroupsChange = (toolGroup: string) => {
    const currentToolGroups = profile.toolGroups || [];
    const newToolGroups = currentToolGroups.includes(toolGroup)
      ? currentToolGroups.filter((tg) => tg !== toolGroup)
      : [...currentToolGroups, toolGroup];
    handleProfileChange(
      profile.id,
      "toolGroups",
      sortBy(newToolGroups, (tg) => tg.toLowerCase()),
    );
  };

  return (
    <tr className="border-t border-[var(--color-border-primary)]">
      <td className="p-2 w-64">
        <Input
          value={profile.name}
          onChange={(e) =>
            handleProfileChange(profile.id, "name", e.target.value)
          }
          placeholder="Profile Name"
          className="bg-background shadow-none rounded-md border-[1px] font-normal"
          disabled={isDefaultProfile || isPendingUpdateAppConfig}
          autoFocus={shouldAutoFocus}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </td>
      <td className="p-2 w-64">
        <MultiSelect
          options={agentsOptions}
          selected={profile.agents}
          onCreateNew={onCreateNewAgent}
          onSelectionChange={handleAgentsChange}
          getTriggerText={(selected) =>
            isDefaultProfile
              ? "any agent"
              : selected.length > 0
                ? `${selected.length} selected`
                : `Select Agents...`
          }
          disabled={isDefaultProfile || isPendingUpdateAppConfig}
        />
      </td>
      <td className="p-2 w-64">
        <Select
          value={profile.permission}
          onValueChange={(value) =>
            handleProfileChange(profile.id, "permission", value)
          }
          disabled={isPendingUpdateAppConfig}
        >
          <SelectTrigger className="bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="allow">Allow</SelectItem>
            <SelectItem value="allow-all">Allow All</SelectItem>
            <SelectItem value="block">Block</SelectItem>
            <SelectItem value="block-all">Block All</SelectItem>
          </SelectContent>
        </Select>
      </td>
      <td className="p-2 w-64">
        <MultiSelectTools
          title="Tool Groups"
          options={toolGroups}
          selected={profile.toolGroups}
          onSelectionChange={handleToolGroupsChange}
          onCreateNew={onCreateNewToolGroup}
          disabled={
            isPendingUpdateAppConfig ||
            profile.permission === "allow-all" ||
            profile.permission === "block-all"
          }
          placeholder={
            profile.permission === "allow-all" ||
            profile.permission === "block-all"
              ? "All Tools"
              : undefined
          }
        />
      </td>
      <td className="p-2 flex items-center justify-end gap-2">
        {enableDuplicateButton && (
          <Button
            onClick={() => onDuplicateProfile(profile.id)}
            size="icon"
            variant="secondary"
            className="text-[var(--color-fg-interactive)] hover:text-[--color-fg-interactive-hover]"
            disabled={isPendingUpdateAppConfig}
          >
            <CopyPlus className="w-4 h-4" />
          </Button>
        )}
        {enableRemoveButton && (
          <Button
            onClick={() => onRemoveProfile(profile.id)}
            size="icon"
            variant="secondary"
            className="text-[var(--color-fg-interactive)]"
            disabled={isPendingUpdateAppConfig}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </td>
    </tr>
  );
};

export function AgentProfiles({
  agents = [],
  getIsAgentDisabledForProfile,
  isPendingUpdateAppConfig,
  mcpServers,
  profiles,
  setAgentsList,
  setProfiles,
  setToolGroups,
  toolGroups,
}: {
  agents: string[];
  getIsAgentDisabledForProfile: ({
    profileId,
    agentId,
  }: {
    profileId: string;
    agentId: string;
  }) => boolean;
  isPendingUpdateAppConfig: boolean;
  mcpServers: {
    name: string;
    tools: {
      name: string;
      description: string | undefined;
    }[];
  }[];
  profiles: AgentProfile[];
  setAgentsList: (updater: (agents: string[]) => string[]) => void;
  setProfiles: (updater: (profiles: AgentProfile[]) => AgentProfile[]) => void;
  setToolGroups: (updater: (toolGroups: ToolGroup[]) => ToolGroup[]) => void;
  toolGroups: ToolGroup[];
}) {
  const [showCreateToolGroup, setShowCreateToolGroup] = useState(false);
  const [newToolGroupProfileId, setNewToolGroupProfileId] = useState("");
  const [showInfoSection, setShowInfoSection] = useState(false);

  const handleProfileChange = (
    id: string,
    field: keyof AgentProfile,
    value: AgentProfile[keyof AgentProfile],
  ) => {
    setProfiles((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
    );
  };

  const addProfile = () => {
    let profileNumber = 1;
    let profileName = `Profile ${profileNumber}`;

    // Unique profile name
    while (profiles.some((p) => p.name === profileName)) {
      profileNumber++;
      profileName = `Profile ${profileNumber}`;
    }

    const newProfile: AgentProfile = {
      id: `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: profileName,
      permission: "allow",
      agents: [],
      toolGroups: [],
    };

    setProfiles((prev) => [...prev, newProfile]);
  };

  const duplicateProfile = (profileId: string) => {
    const profile = profiles.find((p) => p.id === profileId);
    if (!profile) return;

    let copyNumber = 1;
    let copyName = `${profile.name} (Copy ${copyNumber})`;

    // Unique copy name
    while (profiles.some((p) => p.name === copyName)) {
      copyNumber++;
      copyName = `${profile.name} (Copy ${copyNumber})`;
    }

    const newProfile: AgentProfile = {
      ...profile,
      id: `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: copyName,
      agents: [],
    };

    setProfiles((prev) => [...prev, newProfile]);
  };

  const removeProfile = (profileId: string) => {
    setProfiles((prev) => prev.filter((p) => p.id !== profileId));
  };

  const saveNewToolGroup = (newGroup: ToolGroup) => {
    newGroup = {
      ...newGroup,
      id: `tool_group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    setToolGroups((prev) => [...prev, newGroup]);
    handleProfileChange(newToolGroupProfileId, "toolGroups", [
      ...(profiles.find((p) => p.id === newToolGroupProfileId)?.toolGroups ||
        []),
      newGroup.id,
    ]);
    setNewToolGroupProfileId("");
    setShowCreateToolGroup(false);
  };

  const handleCreateNewAgent = (newAgentName: string) => {
    setAgentsList((prev) => [...new Set([...prev, newAgentName])]);
  };

  const handleCreateNewToolGroup = (id: string) => {
    setNewToolGroupProfileId(id);
    setShowCreateToolGroup(true);
  };

  const allAgentsOptions = agents.map((agent) => ({
    label: agent,
    value: agent,
    disabled: false,
  }));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h3
            className="text-lg font-medium flex items-center cursor-pointer hover:text-[var(--color-fg-interactive)]"
            onClick={() => setShowInfoSection(!showInfoSection)}
          >
            Agent Profile Permissions
            <Info
              className="ml-2 w-4 h-4 text-[var(--color-fg-interactive)] hover:text-[var(--color-fg-interactive-hover)] cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setShowInfoSection(!showInfoSection);
              }}
            />
          </h3>
        </div>
        <Button
          onClick={addProfile}
          size="sm"
          variant="secondary"
          className="px-2 border-[var(--color-border-interactive)] text-[var(--color-fg-interactive)] hover:bg-[var(--color-bg-interactive-hover)] hover:text-[var(--color-fg-interactive-hover)] focus:text-[var(--color-fg-interactive-hover)] focus:bg-[var(--color-bg-interactive-hover)]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Profile
        </Button>
      </div>

      {showInfoSection && (
        <div className="text-sm text-[var(--color-text-secondary)] bg-[var(--color-bg-neutral)] p-3 rounded-lg border border-[var(--color-border-primary)]">
          <p>
            Each agent can be assigned to only one profile, unassigned agents
            will use the "Default" profile.
          </p>
          <p className="mt-2 text-xs">
            Available agents:{" "}
            {
              agents.filter(
                (agent) =>
                  !profiles.some(
                    (p) =>
                      p.name !== DEFAULT_PROFILE_NAME &&
                      p.agents.includes(agent),
                  ),
              ).length
            }{" "}
            of {agents.length}
          </p>
        </div>
      )}

      {showCreateToolGroup && (
        <ToolGroupModal
          mcpServers={mcpServers}
          onClose={() => setShowCreateToolGroup(false)}
          saveToolGroup={saveNewToolGroup}
          toolGroups={toolGroups}
        />
      )}

      <div className="border border-[var(--color-border-primary)] rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-neutral)]">
            <tr className="text-left font-medium">
              <th className="p-3">Profile</th>
              <th className="p-3">Agents</th>
              <th className="p-3">Permission Type</th>
              <th className="p-3">Tools</th>
              <th className="p-3 text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile, index) => (
              <AgentProfileRow
                key={profile.id}
                agentsOptions={allAgentsOptions.map((agent) => ({
                  disabled: getIsAgentDisabledForProfile({
                    profileId: profile.id,
                    agentId: agent.value,
                  }),
                  label: agent.label,
                  value: agent.value,
                }))}
                handleProfileChange={handleProfileChange}
                isDefaultProfile={index === 0}
                isPendingUpdateAppConfig={isPendingUpdateAppConfig}
                onCreateNewAgent={handleCreateNewAgent}
                onCreateNewToolGroup={() =>
                  handleCreateNewToolGroup(profile.id)
                }
                onDuplicateProfile={duplicateProfile}
                onRemoveProfile={removeProfile}
                profile={profile}
                toolGroups={toolGroups}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
