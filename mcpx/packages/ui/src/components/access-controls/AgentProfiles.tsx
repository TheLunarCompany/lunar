import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AgentProfile, ToolGroup } from "@/store";
import sortBy from "lodash/sortBy";
import { CopyPlus, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { MultiSelect } from "./MultiSelect";
import { MultiSelectTools } from "./MultiSelectTools";
import { ToolGroupModal } from "./ToolGroupModal";

const AgentProfileRow = ({
  agentsOptions,
  isDefaultProfile = false,
  isPendingUpdateAppConfig,
  handleMultiSelectChange,
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
  handleMultiSelectChange: (
    id: string,
    field: keyof AgentProfile,
    value: any,
  ) => void;
  handleProfileChange: (
    id: string,
    field: keyof AgentProfile,
    value: any,
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
          onSelectionChange={(agent) =>
            handleMultiSelectChange(profile.id, "agents", agent)
          }
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
          onSelectionChange={(value) =>
            handleMultiSelectChange(profile.id, "toolGroups", value)
          }
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
            variant="ghost"
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
            variant="ghost"
            className="text-[var(--color-fg-danger)] hover:text-[--color-fg-danger-hover]"
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

  const handleProfileChange = (
    id: string,
    field: keyof AgentProfile,
    value: any,
  ) => {
    setProfiles((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
    );
  };

  const handleMultiSelectChange = (
    id: string,
    field: keyof AgentProfile,
    value: any,
  ) => {
    const currentValues = profiles.find((p) => p.id === id)?.[field];
    const currentArray = Array.isArray(currentValues)
      ? currentValues
      : currentValues
        ? [currentValues]
        : [];
    const newValues = currentArray.includes(value)
      ? currentArray.filter((item) => item !== value)
      : [...currentArray, value];
    handleProfileChange(
      id,
      field,
      sortBy(newValues, (item) => item.toLowerCase()),
    );
  };

  const addProfile = () => {
    const newProfile: AgentProfile = {
      id: `profile_${profiles.length}`,
      name: "",
      permission: "block",
      agents: [],
      toolGroups: [],
    };

    setProfiles((prev) => [...prev, newProfile]);
  };

  const duplicateProfile = (profile: AgentProfile) => {
    const newProfile: AgentProfile = {
      ...profile,
      id: `profile_${profiles.length}`,
      name: `${profile.name} (Copy)`,
      agents: [],
    };

    setProfiles((prev) => [...prev, newProfile]);
  };

  const removeProfile = (profile: AgentProfile) => {
    setProfiles((prev) => prev.filter((p) => p.id !== profile.id));
  };

  const saveNewToolGroup = (newGroup: ToolGroup) => {
    newGroup = { ...newGroup, id: `tool_group_${toolGroups.length}` };
    setToolGroups((prev) => [...prev, newGroup]);
    handleMultiSelectChange(newToolGroupProfileId, "toolGroups", newGroup.id);
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
  }));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Agent Profile Permissions</h3>
        <Button
          onClick={addProfile}
          size="sm"
          variant="outline"
          className="px-2 border-[var(--color-border-interactive)] text-[var(--color-fg-interactive)] hover:bg-[var(--color-bg-interactive-hover)] hover:text-[var(--color-fg-interactive-hover)] focus:text-[var(--color-fg-interactive-hover)] focus:bg-[var(--color-bg-interactive-hover)]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Profile
        </Button>
      </div>

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
                handleMultiSelectChange={handleMultiSelectChange}
                handleProfileChange={handleProfileChange}
                isDefaultProfile={index === 0}
                isPendingUpdateAppConfig={isPendingUpdateAppConfig}
                onCreateNewAgent={handleCreateNewAgent}
                onCreateNewToolGroup={() =>
                  handleCreateNewToolGroup(profile.id)
                }
                onDuplicateProfile={() => duplicateProfile(profile)}
                onRemoveProfile={() => removeProfile(profile)}
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
