import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import sortBy from "lodash/sortBy";
import { CopyPlus, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { MultiSelect } from "./MultiSelect";
import { ToolGroupModal } from "./ToolGroupModal";

export function ToolGroups({
  mcpServers,
  setProfiles,
  setToolGroups,
  toolGroups,
}) {
  const [showCreateToolGroup, setShowCreateToolGroup] = useState(false);

  const availableTools = useMemo(
    () =>
      mcpServers
        ? mcpServers.flatMap((server) =>
            server.tools.map((tool) => ({
              server: server.name,
              name: tool.name,
              description: tool.description,
            })),
          )
        : [],
    [mcpServers],
  );

  const handleToolGroupChange = (id, server, value) => {
    setToolGroups((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              services: {
                ...p.services,
                [server]: value,
              },
            }
          : p,
      ),
    );
  };

  const handleMultiSelectChange = (id, server, value) => {
    const currentServices = toolGroups.find((p) => p.id === id)?.services || {};
    const currentValues = currentServices[server] || [];
    const newValues = currentValues.includes(value)
      ? currentValues.filter((item) => item !== value)
      : [...currentValues, value];
    handleToolGroupChange(
      id,
      server,
      newValues.length
        ? sortBy(newValues, (tool) => tool.toLowerCase())
        : undefined,
    );
  };

  const addToolGroup = (newGroup) => {
    setToolGroups((prev) => [
      ...prev,
      { ...newGroup, id: `tool_group_${toolGroups.length}` },
    ]);
  };

  const duplicateToolGroup = (group) => {
    const newGroup = {
      ...group,
      id: `tool_group_${toolGroups.length}`,
      name: `${group.name} (Copy)`,
    };
    setToolGroups((prev) => [...prev, newGroup]);
  };

  const removeToolGroup = (group) => {
    const { id } = group;

    setToolGroups((prev) => prev.filter((p) => p.id !== id));

    setProfiles((prev) =>
      prev.map((p) =>
        // Remove the tool group from profiles that have it
        p.toolGroups?.includes(id)
          ? {
              ...p,
              toolGroups: p.toolGroups.filter((tg) => tg !== id),
            }
          : p,
      ),
    );
  };

  const handleToolGroupNameChange = (id, newName) => {
    const oldName = toolGroups.find((tg) => tg.id === id)?.name;

    if (oldName === newName) return;

    setToolGroups((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name: newName } : p)),
    );
  };

  const toolsOptions = availableTools.map((tool) => ({
    label: `${tool.server} - ${tool.name}`,
    value: tool.name,
  }));

  const getSelectedTools = (group) =>
    Object.values(group.services).flatMap(
      (tools) => tools?.map((tool) => tool) || [],
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Tool Groups</h3>
        <Button
          onClick={() => setShowCreateToolGroup(true)}
          size="sm"
          variant="outline"
          className="px-2 border-[var(--color-border-interactive)] text-[var(--color-fg-interactive)] hover:bg-[var(--color-bg-interactive-hover)] hover:text-[var(--color-fg-interactive-hover)] focus:text-[var(--color-fg-interactive-hover)] focus:bg-[var(--color-bg-interactive-hover)]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Tool Group
        </Button>
      </div>
      <div className="border border-[var(--color-border-primary)] rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-neutral)] text-[var(--color-text-primary)]">
            <tr className="text-left font-medium">
              <th className="p-3">Tool group name</th>
              <th className="p-3">Tools</th>
              <th className="p-3 text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            {toolGroups.map((group, index) => (
              <tr
                key={`tool_group_${index}`}
                className="border-t border-[var(--color-border-primary)]"
              >
                <td className="p-2 w-64">
                  <Input
                    value={group.name}
                    onChange={(e) =>
                      handleToolGroupNameChange(group.id, e.target.value)
                    }
                    placeholder="Profile Name"
                    className="bg-background shadow-none rounded-md border-[1px] font-normal"
                  />
                </td>
                <td className="p-2 w-64">
                  <MultiSelect
                    title="Tools"
                    options={toolsOptions}
                    selected={getSelectedTools(group)}
                    onSelectionChange={(tool) =>
                      handleMultiSelectChange(
                        group.id,
                        availableTools.find((option) => option.name === tool)
                          .server,
                        tool,
                      )
                    }
                  />
                </td>

                <td className="p-2 flex items-center justify-end gap-2">
                  <Button
                    onClick={() => duplicateToolGroup(group)}
                    size="icon"
                    variant="ghost"
                    className="text-[var(--color-fg-interactive)] hover:text-[--color-fg-interactive-hover]"
                  >
                    <CopyPlus className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={() => removeToolGroup(group)}
                    size="icon"
                    variant="ghost"
                    className="text-[var(--color-fg-danger)] hover:text-[--color-fg-danger-hover]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreateToolGroup && (
        <ToolGroupModal
          mcpServers={mcpServers}
          onClose={() => setShowCreateToolGroup(false)}
          saveNewToolGroup={addToolGroup}
        />
      )}
    </div>
  );
}
