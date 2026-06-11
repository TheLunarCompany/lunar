import { useState } from "react";
import { Search, ChevronDown, Activity } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MarkdownContent } from "@/components/MarkdownContent";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import PromptIcon from "@/components/capabilities/icons/prompt.svg?react";
import type { McpServerPrompt, McpServerTool } from "@/types/mcp-server";

type ServerCapability = McpServerTool | McpServerPrompt;
type CapabilityVariant = "tool" | "prompt";

function CapabilityCard({
  item,
  variant,
}: {
  item: ServerCapability;
  variant: CapabilityVariant;
}) {
  const [open, setOpen] = useState(false);
  const hasDescription = Boolean(item.description?.trim());
  const isPrompt = variant === "prompt";

  const header = (
    <div className="flex flex-wrap items-center gap-2">
      <span
        data-testid={isPrompt ? "server-prompt-badge" : undefined}
        className={`inline-flex items-center gap-2 rounded-[6px] px-1.5 py-1 text-sm font-medium text-foreground ${
          isPrompt ? "bg-[var(--colors-success-100)]" : "bg-[#EBE6FB]"
        }`}
      >
        {isPrompt && (
          <PromptIcon data-testid="server-prompt-icon" className="size-4" />
        )}
        {item.name}
      </span>

      {item.invocations > 0 && (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Activity className="h-3 w-3" />
          {item.invocations}
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
          content={item.description}
          className="text-[14px] text-foreground leading-relaxed prose prose-sm max-w-none"
        />
      </CollapsibleContent>
    </Collapsible>
  );
}

export interface ServerToolsListProps {
  tools: McpServerTool[];
}

export interface ServerPromptsListProps {
  prompts: McpServerPrompt[];
}

interface ServerCapabilitiesListProps {
  items: ServerCapability[];
  searchPlaceholder: string;
  emptyMessage: string;
  variant: CapabilityVariant;
}

function ServerCapabilitiesList({
  items,
  searchPlaceholder,
  emptyMessage,
  variant,
}: ServerCapabilitiesListProps): React.JSX.Element {
  const [searchQuery, setSearchQuery] = useState("");

  const q = searchQuery.trim().toLowerCase();
  const filteredItems = q
    ? items.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          (item.description ?? "").toLowerCase().includes(q),
      )
    : items;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative min-w-0">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder={searchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-9 pl-3 pr-9 text-sm"
        />
      </div>

      <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
        {filteredItems.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {emptyMessage}
          </p>
        ) : (
          filteredItems.map((item) => (
            <CapabilityCard key={item.name} item={item} variant={variant} />
          ))
        )}
      </div>
    </div>
  );
}

export function ServerToolsList({
  tools,
}: ServerToolsListProps): React.JSX.Element {
  return (
    <ServerCapabilitiesList
      items={tools}
      searchPlaceholder="Search tools..."
      emptyMessage="No tools match your search"
      variant="tool"
    />
  );
}

export function ServerPromptsList({
  prompts,
}: ServerPromptsListProps): React.JSX.Element {
  return (
    <ServerCapabilitiesList
      items={prompts}
      searchPlaceholder="Search prompts..."
      emptyMessage="No prompts match your search"
      variant="prompt"
    />
  );
}
