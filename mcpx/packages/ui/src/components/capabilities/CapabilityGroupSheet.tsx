import { Button } from "@/components/ui/button";
import { useDomainIcon } from "@/hooks/useDomainIcon";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FileEdit, Trash2, Wrench } from "lucide-react";
import McpIcon from "../dashboard/SystemConnectivity/nodes/Mcpx_Icon.svg?react";
import { buildCapabilitySelectionKey } from "./capability-selection-key";
import type {
  CapabilityGroup,
  CapabilityItem,
  CapabilityProvider,
} from "./types";

type CapabilityGroupSheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  group: CapabilityGroup | null;
  providers: CapabilityProvider[];
  onShowItemDetails: (item: CapabilityItem) => void;
  onEditGroup: (group: CapabilityGroup) => void;
  onUpdateGroupItems: (group: CapabilityGroup) => void;
  onDeleteGroup: (group: CapabilityGroup) => void;
};

function findGroupItems(
  group: CapabilityGroup,
  providers: CapabilityProvider[],
) {
  return Object.entries(group.services).map(([providerName, savedItems]) => {
    const provider = providers.find(
      (candidate) => candidate.name === providerName,
    );
    const savedItemNames =
      savedItems === "*"
        ? (provider?.items.map((item) => item.name) ?? [])
        : savedItems;
    const items = savedItemNames.map((itemName) => {
      const liveItem = provider?.items.find((item) => item.name === itemName);
      return (
        liveItem ?? {
          id: buildCapabilitySelectionKey(providerName, itemName),
          kind: "tool" as const,
          name: itemName,
          description: "",
          providerName,
        }
      );
    });

    return { provider, providerName, items };
  });
}

function ProviderIcon({
  provider,
  providerName,
}: {
  provider?: CapabilityProvider;
  providerName: string;
}) {
  const iconSrc = useDomainIcon(providerName);

  if (iconSrc) {
    return (
      <img
        src={iconSrc}
        alt={`${providerName} favicon`}
        className="size-8 object-contain"
      />
    );
  }

  return (
    <McpIcon
      role="img"
      aria-label={`${providerName} fallback logo`}
      className="size-8"
      style={{ color: provider?.icon ?? "black" }}
    />
  );
}

export function CapabilityGroupSheet({
  isOpen,
  onOpenChange,
  group,
  providers,
  onShowItemDetails,
  onEditGroup,
  onUpdateGroupItems,
  onDeleteGroup,
}: CapabilityGroupSheetProps) {
  const providerItems = group ? findGroupItems(group, providers) : [];

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[600px] max-w-[600px]! gap-0 overflow-x-hidden border-l-2 border-primary bg-white p-0"
      >
        <SheetHeader className="px-6 py-6">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <SheetTitle className="truncate text-xl">
              {group?.name ?? "No tool group selected"}
            </SheetTitle>
            {group && (
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEditGroup(group)}
                  aria-label="Edit Tool Group"
                >
                  <FileEdit className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onUpdateGroupItems(group)}
                  aria-label="Update Tools"
                >
                  <Wrench className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeleteGroup(group)}
                  aria-label="Delete"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            )}
          </div>
          <SheetDescription>{group?.description}</SheetDescription>
        </SheetHeader>

        {!group ? (
          <div className="px-6 py-8 text-sm text-[var(--colors-gray-600)]">
            Choose a tool group to view details.
          </div>
        ) : providerItems.length === 0 ? (
          <div className="px-6 py-8 text-sm text-[var(--colors-gray-600)]">
            This tool group has no tools.
          </div>
        ) : (
          <div className="space-y-4 overflow-y-auto px-6 py-2">
            {providerItems.map(({ provider, providerName, items }) => (
              <section
                key={providerName}
                className="space-y-3 rounded-lg border border-[var(--colors-gray-200)] bg-white p-4"
              >
                <div className="flex items-center gap-2">
                  <ProviderIcon
                    provider={provider}
                    providerName={providerName}
                  />
                  <h3 className="text-lg font-semibold capitalize text-[var(--colors-gray-900)]">
                    {providerName}
                  </h3>
                </div>
                <div className="space-y-2">
                  {items.length === 0 ? (
                    <p className="text-sm text-[var(--colors-gray-600)]">
                      No tools available
                    </p>
                  ) : (
                    items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-[var(--colors-gray-200)] p-4"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{item.name}</p>
                          <p className="line-clamp-2 text-sm text-[var(--colors-gray-600)]">
                            {item.description}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onShowItemDetails(item)}
                          aria-label={`Details for ${item.name}`}
                        >
                          Details
                        </Button>
                      </div>
                    ))
                  )}
                </div>
                <p className="text-xs text-[var(--colors-gray-500)]">
                  {items.length} tool{items.length === 1 ? "" : "s"}
                </p>
              </section>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
