import CustomBadge from "@/components/CustomBadge";
import HierarchyBadge from "@/components/HierarchyBadge";
import { MarkdownContent } from "@/components/MarkdownContent";
import { Button } from "@/components/ui/button";
import { SemanticBadge } from "@/components/ui/semantic-badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { useDomainIcon } from "@/hooks/useDomainIcon";
import ArrowRightIcon from "@/icons/arrow_line_rigth.svg?react";
import PencilIcon from "@/icons/pencil_simple_icon.svg?react";
import TrashIcon from "@/icons/trash_icons.svg?react";
import { Settings } from "lucide-react";
import type { PromptMessage } from "@modelcontextprotocol/sdk/types.js";
import AssistantMessageIcon from "./icons/assistant-message.svg?react";
import CustomCapabilityBadgeSvg from "./icons/custom-capability-badge.svg?react";
import UserMessageIcon from "./icons/user-message.svg?react";
import type { CapabilityItem } from "./types";

type CapabilityItemDetailsDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  item: CapabilityItem | null;
  onCustomizeItem: (item: CapabilityItem) => void;
  onEditItem: (item: CapabilityItem) => void;
  onDeleteItem: (item: CapabilityItem) => void;
};

function schemaProperties(item: CapabilityItem | null) {
  const properties = item?.inputSchema?.properties;
  if (!properties || typeof properties !== "object") {
    return [];
  }

  return Object.entries(properties).map(([name, schema]) => {
    const record =
      typeof schema === "object" && schema !== null
        ? (schema as Record<string, unknown>)
        : {};

    return {
      name,
      type: typeof record.type === "string" ? record.type : "unknown",
      description:
        typeof record.description === "string" ? record.description : "",
    };
  });
}

function displayName(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function promptMessageText(message: PromptMessage): string {
  const content = message.content;

  if ("text" in content && typeof content.text === "string") {
    return content.text;
  }

  if (content.type === "image") {
    return "Image content";
  }

  if (content.type === "audio") {
    return "Audio content";
  }

  return "Embedded resource";
}

function PromptMessagesSection({ item }: { item: CapabilityItem }) {
  const messages = item.messages ?? [];

  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold text-mcpx-text">Messages</h3>
      <div className="min-h-[320px] space-y-4 rounded-lg border border-[var(--mcpx-border-subtle)] bg-[var(--mcpx-surface-subtle)] p-4">
        {messages.length > 0 ? (
          messages.map((message, index) => {
            const isAssistant = message.role === "assistant";
            const roleLabel = isAssistant ? "Assistant" : "User";

            return (
              <div
                key={`${message.role}-${index}`}
                className={`flex gap-4 ${isAssistant ? "justify-end" : "justify-start"}`}
              >
                {!isAssistant && (
                  <UserMessageIcon
                    aria-label="User message"
                    className="mt-1 size-8 shrink-0"
                  />
                )}
                <div
                  className={`max-w-[420px] rounded-lg p-4 text-sm leading-[1.34] tracking-normal text-mcpx-text shadow-[var(--mcpx-shadow-weak)] ${
                    isAssistant
                      ? "rounded-tr-none bg-mcpx-info-bg"
                      : "rounded-tl-none bg-mcpx-success-bg"
                  }`}
                >
                  <p className="mb-1 text-xs font-semibold">{roleLabel}</p>
                  <MarkdownContent
                    content={promptMessageText(message)}
                    className="min-w-0 max-w-full overflow-x-hidden text-sm leading-[1.34] [&_p]:mb-0 [&_strong]:font-bold"
                  />
                </div>
                {isAssistant && (
                  <AssistantMessageIcon
                    aria-label="Assistant message"
                    className="mt-1 size-8 shrink-0"
                  />
                )}
              </div>
            );
          })
        ) : (
          <div className="py-8 text-center text-sm text-[var(--mcpx-text-tertiary)]">
            <Settings className="mx-auto mb-3 size-8" />
            No messages available for this prompt template
          </div>
        )}
      </div>
    </section>
  );
}

export function CapabilityItemDetailsDialog({
  isOpen,
  onClose,
  item,
  onCustomizeItem,
  onEditItem,
  onDeleteItem,
}: CapabilityItemDetailsDialogProps) {
  const parameters = schemaProperties(item);
  const providerIcon = useDomainIcon(item?.providerName ?? "");
  const isPrompt = item?.kind === "prompt";

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        aria-describedby={undefined}
        showCloseButton={false}
        className="w-[600px]! max-w-[600px]! overflow-y-auto border-l-2 border-primary bg-mcpx-surface p-0"
      >
        {item ? (
          <>
            <div className="flex items-center justify-between gap-2 border-b border-[var(--mcpx-border-subtle)] px-6 py-4">
              <div className="flex items-center gap-2">
                {item.isCustom && (
                  <CustomBadge
                    color="blue"
                    size="md"
                    rounded="lg"
                    label={<span>CUSTOM</span>}
                    icon={
                      <CustomCapabilityBadgeSvg
                        aria-label="Custom capability icon"
                        className="size-5"
                        style={{ color: "var(--mcpx-selected)" }}
                      />
                    }
                  />
                )}
              </div>
              <div className="flex items-center gap-1">
                {item.isCustom ? (
                  <>
                    {!isPrompt && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Edit custom capability"
                        onClick={() => onEditItem(item)}
                      >
                        <PencilIcon />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete custom capability"
                      onClick={() => onDeleteItem(item)}
                    >
                      <TrashIcon />
                    </Button>
                  </>
                ) : !isPrompt ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Customize capability"
                    onClick={() => onCustomizeItem(item)}
                  >
                    <PencilIcon />
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onClose}
                  aria-label="Close"
                >
                  <ArrowRightIcon />
                </Button>
              </div>
            </div>

            <div className="border-b border-[var(--mcpx-border-subtle)] px-6 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <img
                  src={providerIcon}
                  alt={`${item.providerName} favicon`}
                  className="size-10 shrink-0 object-contain"
                />
                <div className="min-w-0">
                  <SheetTitle className="truncate text-lg font-semibold">
                    {displayName(item.providerName)}
                  </SheetTitle>
                  <SheetDescription asChild>
                    {item.isCustom ? (
                      <HierarchyBadge
                        serverName={item.originalToolName || ""}
                        toolName={item.name}
                      />
                    ) : (
                      <HierarchyBadge serverName={item.name} toolName="" />
                    )}
                  </SheetDescription>
                </div>
              </div>
            </div>

            <div className="space-y-6 px-6 py-4">
              <section>
                <h3 className="mb-1 text-base font-semibold">Description</h3>
                <MarkdownContent
                  content={item.description || "No description available"}
                  className="min-w-0 w-full max-w-full overflow-x-hidden text-foreground text-sm leading-relaxed [&_pre]:max-w-full [&_pre]:overflow-x-hidden [&_pre]:whitespace-pre-wrap [&_pre]:wrap-break-word [&_code]:wrap-break-word"
                />
              </section>

              {item.annotations && (
                <section>
                  <h3 className="mb-2 text-base font-semibold">Annotations</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {item.annotations.readOnlyHint && (
                      <SemanticBadge tone="success" showDot={false}>
                        Read-only
                      </SemanticBadge>
                    )}
                    {item.annotations.destructiveHint && (
                      <SemanticBadge tone="danger" showDot={false}>
                        Destructive
                      </SemanticBadge>
                    )}
                    {!item.annotations.readOnlyHint &&
                      !item.annotations.destructiveHint && (
                        <SemanticBadge tone="warning" showDot={false}>
                          Write
                        </SemanticBadge>
                      )}
                  </div>
                </section>
              )}

              {item.kind === "prompt" ? (
                <PromptMessagesSection item={item} />
              ) : (
                <section>
                  <h3 className="mb-2 text-base font-semibold">Parameters</h3>
                  {parameters.length > 0 ? (
                    <div className="space-y-4">
                      {parameters.map((parameter) => (
                        <div
                          key={parameter.name}
                          className="rounded-lg border border-[var(--mcpx-border-subtle)] bg-[var(--mcpx-surface-subtle)] p-3"
                        >
                          <div className="mb-1 flex items-center justify-between gap-3">
                            <p className="font-semibold">{parameter.name}</p>
                            <span className="rounded bg-[var(--mcpx-border-subtle)] px-2 py-1 text-xs">
                              {parameter.type}
                            </span>
                          </div>
                          {parameter.description && (
                            <p className="text-xs text-[var(--mcpx-text-secondary)]">
                              {parameter.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-sm text-[var(--mcpx-text-tertiary)]">
                      <Settings className="mx-auto mb-3 size-8" />
                      No parameters available for this tool
                    </div>
                  )}
                </section>
              )}
            </div>
          </>
        ) : (
          <div className="p-6 text-sm text-[var(--mcpx-text-secondary)]">
            No tool selected
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
