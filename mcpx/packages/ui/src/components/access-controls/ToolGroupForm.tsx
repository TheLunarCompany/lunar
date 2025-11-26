import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronRight, Server } from "lucide-react";
import { useState } from "react";
import { useFormContext, UseFormRegisterReturn } from "react-hook-form";

export function ToolGroupForm({
  mcpServers,
  registerNameField,
  selectedTools,
  setSelectedTools,
}: {
  mcpServers: {
    name: string;
    tools: {
      name: string;
      description: string | undefined;
    }[];
  }[];
  registerNameField: () => UseFormRegisterReturn<"name">;
  selectedTools: Record<string, Record<string, boolean>>;
  setSelectedTools: React.Dispatch<
    React.SetStateAction<Record<string, Record<string, boolean>>>
  >;
}) {
  const {
    formState: { errors },
  } = useFormContext();

  const [expandedServers, setExpandedServers] = useState<
    Record<number, boolean>
  >({});

  return (
    <div className="space-y-4 p-4">
      <div>
        <Label
          className="text-sm text-[var(--color-text-primary)] mb-2 block"
          htmlFor="new-group-name"
        >
          Tool Group Name
        </Label>
        <Input
          placeholder="Enter unique group name"
          className="bg-background"
          autoComplete="off"
          {...registerNameField()}
        />
        <p className="text-xs text-[var(--color-fg-danger)] mt-1 pl-2 h-4">
          {typeof errors.name?.message === "string"
            ? errors.name.message
            : errors.name?.type === "required"
              ? "This field is required."
              : ""}
        </p>
      </div>
      <div>
        <Label className="text-sm mb-3 block">Select MCP Servers & Tools</Label>
        <div className="space-y-2">
          {mcpServers.map((server, serverIndex) => (
            <Collapsible
              id={`server-${serverIndex}`}
              key={server.name}
              open={expandedServers[serverIndex]}
            >
              <div className="border border-[var(--color-border-primary)] rounded-lg">
                <CollapsibleTrigger
                  className="w-full p-3 flex items-center justify-between text-[var(--color-fg-interactive)] hover:bg-[var(--color-bg-interactive-hover)] hover:text-[var(--color-fg-interactive-hover)] cursor-pointer"
                  onClick={(e) => {
                    if (e.currentTarget !== e.target) {
                      // Prevent toggling if clicking on checkbox
                      return;
                    }
                    setExpandedServers((p) => ({
                      ...p,
                      [serverIndex]: !p[serverIndex],
                    }));
                  }}
                >
                  {/*
                   * Here we use `pointer-events-none` to make sure
                   * that the event target is always the CollapsibleTrigger.
                   * This way we can distinguish between clicks on the trigger
                   * and clicks on the checkbox.
                   */}
                  <div className="flex items-center gap-3 pointer-events-none">
                    {expandedServers[serverIndex] ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    <Server className="w-4 h-4" />
                    <span className="font-medium text-sm truncate max-w-[26rem]">
                      {server.name}
                    </span>
                  </div>
                  <Checkbox
                    checked={
                      server.tools.length > 0 &&
                      server.tools.every(
                        (tool) => selectedTools[server.name]?.[tool.name],
                      )
                        ? true
                        : server.tools.length > 0 &&
                            server.tools.some(
                              (tool) => selectedTools[server.name]?.[tool.name],
                            )
                          ? "indeterminate"
                          : false
                    }
                    onClick={(e) => {
                      const newSelected = { ...selectedTools };
                      const checked = server.tools.every(
                        (tool) => selectedTools[server.name]?.[tool.name],
                      );
                      server.tools.forEach((tool) => {
                        newSelected[server.name] = {
                          ...newSelected[server.name],
                          [tool.name]: !checked,
                        };
                      });
                      setSelectedTools(newSelected);
                      return false;
                    }}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="px-6 pb-3">
                  <div className="space-y-2 pt-2">
                    {server.tools.map((tool, toolIndex) => (
                      <div
                        key={toolIndex}
                        className="flex items-center justify-between gap-3 py-2 border-t border-[var(--color-border-primary)] first:border-t-0"
                      >
                        <div>
                          <div className="font-medium text-sm text-[var(--color-text-primary)]">
                            {tool.name}
                          </div>
                          <div className="text-xs text-[var(--color-fg-info)]">
                            {tool.description}
                          </div>
                        </div>
                        <Checkbox
                          checked={
                            selectedTools[server.name]?.[tool.name] || false
                          }
                          onClick={(e) => {
                            setSelectedTools((p) => ({
                              ...p,
                              [server.name]: {
                                ...p[server.name],
                                [tool.name]:
                                  !selectedTools[server.name]?.[tool.name],
                              },
                            }));
                            return false;
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
        </div>
      </div>
    </div>
  );
}
