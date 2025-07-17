import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AccessControlsStore, ToolGroup } from "@/store";
import { CircleX, CopyPlus, Edit, Plus, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { ToolGroupModal } from "./ToolGroupModal";

export function ToolGroups({
  isPendingUpdateAppConfig,
  mcpServers,
  setProfiles,
  setToolGroups,
  toolGroups,
}: {
  isPendingUpdateAppConfig: boolean;
  mcpServers:
    | {
        name: string;
        tools: {
          name: string;
          description: string | undefined;
        }[];
      }[]
    | undefined;
  setProfiles: AccessControlsStore["setProfiles"];
  setToolGroups: AccessControlsStore["setToolGroups"];
  toolGroups: ToolGroup[];
}) {
  const [showToolGroupModal, setShowToolGroupModal] = useState(false);
  const [toolGroupModalInitialData, setToolGroupModalInitialData] =
    useState<ToolGroup | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [search, setSearch] = useState("");
  const displayedToolGroups = useMemo(
    () =>
      toolGroups.filter((group) =>
        group.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [search, toolGroups],
  );

  const saveToolGroup = (group: ToolGroup) => {
    const isExistingGroup =
      toolGroupModalInitialData && toolGroups.some((tg) => tg.id === group.id);
    if (isExistingGroup) {
      const { id: existingGroupId } = toolGroupModalInitialData;
      // Reset the modal state
      setToolGroupModalInitialData(null);
      // Update the existing group
      setToolGroups((prev) =>
        prev.map((p) => (p.id === existingGroupId ? group : p)),
      );

      const oldName = toolGroups.find((tg) => tg.id === existingGroupId)?.name;
      if (oldName === group.name) return;

      // Update the tool group name in profiles that have it
      setProfiles((prev) =>
        prev.map((p) =>
          p.toolGroups?.includes(existingGroupId)
            ? {
                ...p,
                toolGroups: p.toolGroups.map((tg) =>
                  tg === existingGroupId ? group.id : tg,
                ),
              }
            : p,
        ),
      );
      return;
    }

    setToolGroups((prev) => [
      ...prev,
      { ...group, id: `tool_group_${toolGroups.length}` },
    ]);
  };

  const removeToolGroup = (group: ToolGroup) => {
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

  const openCreateModal = () => {
    setToolGroupModalInitialData(null);
    setShowToolGroupModal(true);
  };

  const openEditModal = (group: ToolGroup) => {
    setToolGroupModalInitialData(group);
    setShowToolGroupModal(true);
  };

  const duplicateToolGroup = (group: ToolGroup) => {
    const newGroup = {
      ...group,
      id: `tool_group_${toolGroups.length}`,
      name: `${group.name} (Copy)`,
    };
    openEditModal(newGroup);
  };

  const resetSearch = () => {
    setSearch("");
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Tool Groups</h3>
        <Button
          onClick={() => openCreateModal()}
          size="sm"
          variant="outline"
          className="px-2 border-[var(--color-border-interactive)] text-[var(--color-fg-interactive)] hover:bg-[var(--color-bg-interactive-hover)] hover:text-[var(--color-fg-interactive-hover)] focus:text-[var(--color-fg-interactive-hover)] focus:bg-[var(--color-bg-interactive-hover)]"
          disabled={isPendingUpdateAppConfig}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Tool Group
        </Button>
      </div>
      {toolGroups.length === 0 && (
        <div className="flex flex-col text-lg text-[var(--color-fg-info)] justify-center items-center gap-4 h-64">
          <span>No tool groups found</span>
          <Button
            onClick={() => openCreateModal()}
            variant="outline"
            className="px-2 border-[var(--color-border-interactive)] text-[var(--color-fg-interactive)] hover:bg-[var(--color-bg-interactive-hover)] hover:text-[var(--color-fg-interactive-hover)] focus:text-[var(--color-fg-interactive-hover)] focus:bg-[var(--color-bg-interactive-hover)]"
            disabled={isPendingUpdateAppConfig}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Tool Group
          </Button>
        </div>
      )}
      {toolGroups.length > 0 && (
        <div className="flex items-center focus-within:border-[var(--color-border-secondary)] focus-within:border-solid self-start">
          <Input
            className="bg-background shadow-none rounded-md border-[1px] border-[var(--color-border-interactive)] focus-visible:ring-0 placeholder:text-[var(--color-text-secondary)] font-normal text-sm h-7.5 w-[180px]"
            placeholder="Search tool groups..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            ref={inputRef}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={resetSearch}
                variant="icon"
                className="background-transparent focus-visible:ring-0 hover:text-[var(--color-fg-interactive)] focus:text-[var(--color-fg-interactive)] focus-visible:bg-[var(--color-bg-container-overlay)] h-7 w-4 rounded-none"
              >
                <CircleX />
              </Button>
            </TooltipTrigger>
            <TooltipContent
              align="center"
              className="shadow bg-[var(--color-bg-container)] text-[var(--color-fg-info)] text-xs"
            >
              Clear search
            </TooltipContent>
          </Tooltip>
        </div>
      )}
      {search && displayedToolGroups.length === 0 && toolGroups.length > 0 && (
        <div className="flex flex-col text-lg text-[var(--color-fg-info)] justify-center items-center gap-4 h-64">
          <span>No matches</span>
          <Button
            onClick={resetSearch}
            variant="outline"
            className="px-2 border-[var(--color-border-interactive)] text-[var(--color-fg-interactive)] hover:bg-[var(--color-bg-interactive-hover)] hover:text-[var(--color-fg-interactive-hover)] focus:text-[var(--color-fg-interactive-hover)] focus:bg-[var(--color-bg-interactive-hover)]"
          >
            <CircleX className="w-4 h-4 mr-2" />
            Clear Search
          </Button>
        </div>
      )}
      {displayedToolGroups.length > 0 && (
        <div className="flex flex-wrap items-start gap-4">
          {displayedToolGroups.map((group, index) => (
            <Card
              key={group.id}
              className="bg-[var(--color-bg-container)] border-[var(--color-border-info)] w-64 group"
            >
              <CardHeader className="flex flex-row gap-2 items-start justify-between relative h-20 pb-3">
                <CardTitle className="flex justify-end items-center gap-1.5 font-semibold line-clamp-2 leading-tight">
                  {group.name}
                </CardTitle>
                <div className="flex justify-end items-start gap-1.5 absolute top-2 right-4 bg-[var(--color-bg-container)] rounded-md">
                  <Tooltip disableHoverableContent>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={() => openEditModal(group)}
                        size="icon"
                        variant="ghost"
                        className="text-[var(--color-fg-interactive)] bg-transparent hover:bg-[var(--color-bg-container-overlay)] hover:text-[--color-fg-interactive-hover] hover:shadow-md hidden group-hover:flex"
                        disabled={isPendingUpdateAppConfig}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent
                      align="center"
                      className="shadow bg-[var(--color-bg-container)] text-[var(--color-fg-info)] text-xs"
                      sideOffset={10}
                    >
                      Edit Group
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip disableHoverableContent>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={() => duplicateToolGroup(group)}
                        size="icon"
                        variant="ghost"
                        className="text-[var(--color-fg-interactive)] bg-transparent hover:bg-[var(--color-bg-container-overlay)] hover:text-[--color-fg-interactive-hover] hover:shadow-md hidden group-hover:flex"
                        disabled={isPendingUpdateAppConfig}
                      >
                        <CopyPlus className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent
                      align="center"
                      className="shadow bg-[var(--color-bg-container)] text-[var(--color-fg-info)] text-xs"
                      sideOffset={10}
                    >
                      Duplicate Group
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip disableHoverableContent>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={() => removeToolGroup(group)}
                        size="icon"
                        variant="ghost"
                        className="text-[var(--color-fg-danger)] bg-transparent hover:bg-[var(--color-bg-container-overlay)] hover:text-[--color-fg-danger-hover] hover:shadow-md hidden group-hover:flex"
                        disabled={isPendingUpdateAppConfig}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent
                      align="center"
                      className="shadow bg-[var(--color-bg-container)] text-[var(--color-fg-info)] text-xs"
                      sideOffset={10}
                    >
                      Delete Group
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent className="h-52">
                {Object.keys(group.services).length &&
                Object.values(group.services).some((tools) => tools?.length) ? (
                  <div>
                    <div className="flex flex-col gap-2 bg-transparent">
                      <div className="text-sm grid grid-cols-[minmax(0,1fr)_auto] gap-2 py-2 rounded-md">
                        <strong className="overflow-ellipsis whitespace-nowrap overflow-hidden">
                          Service
                        </strong>
                        <span className="ml-4"># Tools</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      {Object.entries(group.services)
                        .filter(([, tools]) => tools?.length)
                        .sort(
                          ([, toolsA], [, toolsB]) =>
                            toolsB.length - toolsA.length,
                        )
                        .slice(0, 3)
                        .flatMap(([service, tools]) => (
                          <div
                            key={service}
                            className="text-sm grid grid-cols-[minmax(0,1fr)_auto] gap-2 bg-[var(--color-bg-info)] p-2 rounded-md"
                          >
                            <strong className="overflow-ellipsis whitespace-nowrap overflow-hidden">
                              {service}
                            </strong>
                            <span className="ml-4">{tools.length}</span>
                          </div>
                        ))}
                    </div>
                    {Object.entries(group.services).filter(
                      ([, tools]) => tools?.length,
                    ).length > 3 && (
                      <CardDescription className="mt-2 text-xs">
                        <span className="">
                          +{" "}
                          {Object.entries(group.services).filter(
                            ([, tools]) => tools?.length,
                          ).length - 3}{" "}
                          more service
                          {Object.entries(group.services).filter(
                            ([, tools]) => tools?.length,
                          ).length -
                            3 >
                          1
                            ? "s"
                            : ""}{" "}
                          with{" "}
                          {Object.entries(group.services)
                            .sort(
                              ([, toolsA], [, toolsB]) =>
                                toolsB.length - toolsA.length,
                            )
                            .filter(([_, tools]) => tools?.length)
                            .slice(3)
                            .reduce(
                              (acc, [, tools]) => acc + tools.length,
                              0,
                            )}{" "}
                          tool
                          {Object.entries(group.services)
                            .sort(
                              ([, toolsA], [, toolsB]) =>
                                toolsB.length - toolsA.length,
                            )
                            .filter(([_, tools]) => tools?.length)
                            .slice(1)
                            .reduce(
                              (acc, [, tools]) => acc + tools.length,
                              0,
                            ) !== 0
                            ? "s"
                            : ""}
                        </span>
                      </CardDescription>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full">
                    <CardDescription className="text-muted-foreground">
                      No tools selected in this group.
                    </CardDescription>
                    <CardDescription className="text-muted-foreground flex items-center">
                      Click
                      <Button
                        variant="icon"
                        className="p-2 text-[var(--color-fg-interactive)] hover:text-[var(--color-fg-interactive-hover)] focus:text-[var(--color-fg-interactive-hover)]"
                        onClick={() => openEditModal(group)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      to add some.
                    </CardDescription>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showToolGroupModal && (
        <ToolGroupModal
          initialData={toolGroupModalInitialData}
          mcpServers={mcpServers}
          onClose={() => setShowToolGroupModal(false)}
          saveToolGroup={saveToolGroup}
          toolGroups={toolGroups}
        />
      )}
    </div>
  );
}
