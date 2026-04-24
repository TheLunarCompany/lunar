import { useState } from "react";
import { Search, ChevronDown, Activity } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MarkdownContent } from "@/components/MarkdownContent";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { McpServerTool } from "@/types/mcp-server";

function ToolCard({ tool }: { tool: McpServerTool }) {
  const [open, setOpen] = useState(false);
  const hasDescription = Boolean(tool.description?.trim());

  const header = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center rounded-[6px] bg-[#EBE6FB] px-1.5 py-1 text-sm font-medium text-foreground">
        {tool.name}
      </span>

      {tool.invocations > 0 && (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Activity className="h-3 w-3" />
          {tool.invocations}
        </span>
      )}

      {hasDescription && (
        <span className="ml-auto flex items-center gap-1 text-xs font-medium text-foreground">
          {open ? "View Less" : "View More"}
          <ChevronDown
            className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      )}
    </div>
  );

  if (!hasDescription) {
    return (
      <div className="rounded-lg border border-border bg-white p-3 text-sm">
        {header}
      </div>
    );
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-lg border border-border bg-white p-3 text-sm"
    >
      <CollapsibleTrigger className="w-full cursor-pointer">
        {header}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="my-4 border-t border-border" />
        <MarkdownContent
          content={tool.description}
          className="text-[14px] text-foreground leading-relaxed prose prose-sm max-w-none"
        />
      </CollapsibleContent>
    </Collapsible>
  );
}

export interface ServerToolsListProps {
  tools: McpServerTool[];
}

export function ServerToolsList({
  tools,
}: ServerToolsListProps): React.JSX.Element {
  const [searchQuery, setSearchQuery] = useState("");

  const q = searchQuery.trim().toLowerCase();
  const filteredTools = q
    ? tools.filter(
        (tool) =>
          tool.name.toLowerCase().includes(q) ||
          (tool.description ?? "").toLowerCase().includes(q),
      )
    : tools;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative min-w-0">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search tools..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-9 pl-3 pr-9 text-sm"
        />
      </div>

      <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
        {filteredTools.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No tools match your search
          </p>
        ) : (
          filteredTools.map((tool) => <ToolCard key={tool.name} tool={tool} />)
        )}
      </div>
    </div>
  );
}
