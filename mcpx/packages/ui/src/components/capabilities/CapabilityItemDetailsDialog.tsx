import CustomBadge from "@/components/CustomBadge";
import HierarchyBadge from "@/components/HierarchyBadge";
import { MarkdownContent } from "@/components/MarkdownContent";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { useDomainIcon } from "@/hooks/useDomainIcon";
import { Edit, Settings, Trash2, X } from "lucide-react";
import McpIcon from "../dashboard/SystemConnectivity/nodes/Mcpx_Icon.svg?react";
import CustomCapabilityBadgeSvg from "./icons/custom-capability-badge.svg?react";
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

export function CapabilityItemDetailsDialog({
  isOpen,
  onClose,
  item,
  onCustomizeItem,
  onEditItem,
  onDeleteItem,
}: CapabilityItemDetailsDialogProps) {
  const parameters = schemaProperties(item);
  const providerIcon = useDomainIcon(item?.providerName ?? null);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        aria-describedby={undefined}
        showCloseButton={false}
        className="w-[600px]! max-w-[600px]! overflow-y-auto border-l-2 border-primary bg-white p-0"
      >
        {item ? (
          <>
            <div className="flex items-center justify-between gap-2 border-b border-[var(--colors-gray-200)] px-6 py-4">
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
                        style={{ color: "#4F33CC" }}
                      />
                    }
                  />
                )}
              </div>
              <div className="flex items-center gap-2">
                {item.isCustom ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Edit custom capability"
                      onClick={() => onEditItem(item)}
                    >
                      <Edit className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete custom capability"
                      onClick={() => onDeleteItem(item)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Customize capability"
                    onClick={() => onCustomizeItem(item)}
                  >
                    <Edit className="size-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onClose}
                  aria-label="Close"
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>

            <div className="border-b border-[var(--colors-gray-200)] px-6 py-4">
              <div className="flex min-w-0 items-center gap-3">
                {providerIcon ? (
                  <img
                    src={providerIcon}
                    alt={`${item.providerName} favicon`}
                    className="size-10 shrink-0 object-contain"
                  />
                ) : (
                  <McpIcon
                    role="img"
                    aria-label={`${item.providerName} fallback logo`}
                    className="size-10 shrink-0 text-[var(--colors-gray-600)]"
                  />
                )}
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
                      <Badge variant="success">Read-only</Badge>
                    )}
                    {item.annotations.destructiveHint && (
                      <Badge variant="danger">Destructive</Badge>
                    )}
                    {!item.annotations.readOnlyHint &&
                      !item.annotations.destructiveHint && (
                        <Badge variant="warning">Write</Badge>
                      )}
                  </div>
                </section>
              )}

              <section>
                <h3 className="mb-2 text-base font-semibold">Parameters</h3>
                {parameters.length > 0 ? (
                  <div className="space-y-4">
                    {parameters.map((parameter) => (
                      <div
                        key={parameter.name}
                        className="rounded-lg border border-[var(--colors-gray-200)] bg-[var(--colors-gray-50)] p-3"
                      >
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <p className="font-semibold">{parameter.name}</p>
                          <span className="rounded bg-[var(--colors-gray-200)] px-2 py-1 text-xs">
                            {parameter.type}
                          </span>
                        </div>
                        {parameter.description && (
                          <p className="text-xs text-[var(--colors-gray-600)]">
                            {parameter.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-sm text-[var(--colors-gray-500)]">
                    <Settings className="mx-auto mb-3 size-8" />
                    No parameters available for this tool
                  </div>
                )}
              </section>
            </div>
          </>
        ) : (
          <div className="p-6 text-sm text-[var(--colors-gray-600)]">
            No tool selected
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
