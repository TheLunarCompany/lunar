import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronRight, Server } from "lucide-react";

export function ToolGroupForm({
  expandedServers,
  mcpServers,
  newGroupName,
  selectedTools,
  setExpandedServers,
  setNewGroupName,
  setSelectedTools,
}) {
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
          id="new-group-name"
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          placeholder="Enter unique group name"
          className="bg-background"
        />
      </div>
      <div>
        <Label className="text-sm mb-3 block">Select MCP Servers & Tools</Label>
        <div className="space-y-2">
          {mcpServers.map((server, serverIndex) => (
            <Collapsible
              key={server.name}
              open={expandedServers[serverIndex]}
              onOpenChange={() =>
                setExpandedServers((p) => ({
                  ...p,
                  [serverIndex]: !p[serverIndex],
                }))
              }
            >
              <div className="border border-[var(--color-border-primary)] rounded-lg">
                <CollapsibleTrigger className="w-full p-3 flex items-center justify-between text-[var(--color-fg-interactive)] hover:bg-[var(--color-bg-interactive-hover)] hover:text-[var(--color-fg-interactive-hover)] cursor-pointer">
                  <div className="flex items-center gap-3">
                    {expandedServers[serverIndex] ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    <Server className="w-4 h-4" />
                    <span className="font-medium text-sm">{server.name}</span>
                  </div>
                  <Checkbox
                    checked={server.tools.every(
                      (tool) => selectedTools[server.name]?.[tool.name],
                    )}
                    onCheckedChange={(checked) => {
                      const newSelected = { ...selectedTools };
                      server.tools.forEach((tool) => {
                        newSelected[server.name] = {
                          ...newSelected[server.name],
                          [tool.name]: checked,
                        };
                      });
                      setSelectedTools(newSelected);
                    }}
                    onClick={(e) => e.stopPropagation()}
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
                          onCheckedChange={(checked) =>
                            setSelectedTools((p) => ({
                              ...p,
                              [server.name]: {
                                ...p[server.name],
                                [tool.name]: checked,
                              },
                            }))
                          }
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
