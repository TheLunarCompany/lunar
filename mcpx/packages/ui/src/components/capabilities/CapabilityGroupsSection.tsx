import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  FileEdit,
  Trash2,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { CapabilityGroupCard } from "./CapabilityGroupCard";
import type { CapabilityGroup } from "./types";

type CapabilityGroupsSectionProps = {
  groups: CapabilityGroup[];
  selectedGroupName?: string | null;
  onCreateGroupClick: () => void;
  onGroupClick: (group: CapabilityGroup) => void;
  onEditGroup: (group: CapabilityGroup) => void;
  onUpdateGroupItems: (group: CapabilityGroup) => void;
  onDeleteGroup: (group: CapabilityGroup) => void;
};

function totalTools(group: CapabilityGroup): number {
  return group.providers.reduce(
    (total, provider) => total + provider.itemCount,
    0,
  );
}

function hasWildcardProvider(group: CapabilityGroup): boolean {
  return group.providers.some((provider) => provider.isWildcard);
}

function toolCountLabel(group: CapabilityGroup): string {
  return hasWildcardProvider(group)
    ? "All tools"
    : `${totalTools(group)} in group`;
}

export function CapabilityGroupsSection({
  groups,
  selectedGroupName,
  onCreateGroupClick,
  onGroupClick,
  onEditGroup,
  onUpdateGroupItems,
  onDeleteGroup,
}: CapabilityGroupsSectionProps) {
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [openMenuGroupId, setOpenMenuGroupId] = useState<string | null>(null);
  const totalPages = Math.ceil(groups.length / 8);
  const visibleGroups = groups.slice(
    currentGroupIndex * 8,
    (currentGroupIndex + 1) * 8,
  );

  if (groups.length === 0) {
    return (
      <section className="mb-12 rounded-lg border border-dashed border-[var(--colors-gray-200)] bg-white p-8 text-center">
        <p className="text-base font-semibold text-[var(--colors-gray-900)]">
          No Capability Groups yet
        </p>
        <p className="mt-1 text-sm text-[var(--colors-gray-600)]">
          Create a tool group from selected catalog tools.
        </p>
        <Button className="mt-4" size="sm" onClick={onCreateGroupClick}>
          Create Capability Group
        </Button>
      </section>
    );
  }

  return (
    <section className="mb-12 rounded-lg border border-[var(--colors-gray-200)] bg-white p-6 shadow-xs">
      <p className="mb-4 text-base font-semibold text-[var(--colors-gray-900)]">
        Capabilities Groups
      </p>

      <div className="relative">
        {currentGroupIndex > 0 && (
          <Button
            variant="secondary"
            size="sm"
            aria-label="Previous tool groups"
            onClick={() =>
              setCurrentGroupIndex((currentIndex) =>
                Math.max(0, currentIndex - 1),
              )
            }
            className="absolute left-0 top-1/2 z-10 -translate-y-1/2 bg-white shadow-md"
          >
            <ChevronLeft className="size-4" />
          </Button>
        )}

        {currentGroupIndex < totalPages - 1 && (
          <Button
            variant="secondary"
            size="sm"
            aria-label="Next tool groups"
            onClick={() =>
              setCurrentGroupIndex((currentIndex) =>
                Math.min(totalPages - 1, currentIndex + 1),
              )
            }
            className="absolute right-0 top-1/2 z-10 -translate-y-1/2 bg-white shadow-md"
          >
            <ChevronRight className="size-4" />
          </Button>
        )}

        <div className="grid grid-cols-1 gap-4 p-2 sm:grid-cols-2 lg:grid-cols-4">
          {visibleGroups.map((group) => {
            const isSelected = selectedGroupName === group.name;
            const providerCount = group.providers.length;
            const countLabel = toolCountLabel(group);

            return (
              <CapabilityGroupCard
                key={group.id}
                className={cn(
                  "min-h-[156px] max-w-none transition-all",
                  isSelected
                    ? "border-primary shadow-md shadow-primary/20 ring-2 ring-primary/15"
                    : "hover:border-primary/60 hover:shadow-md",
                )}
              >
                <button
                  type="button"
                  className="flex min-h-[124px] w-full flex-1 cursor-pointer flex-col gap-3 pr-8 text-left outline-none"
                  aria-label={`Open ${group.name}`}
                  onClick={() => onGroupClick(group)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onGroupClick(group);
                    }
                  }}
                >
                  <CapabilityGroupCard.Header>
                    <CapabilityGroupCard.Icon />
                    <CapabilityGroupCard.Title>
                      {group.name}
                    </CapabilityGroupCard.Title>
                  </CapabilityGroupCard.Header>

                  <CapabilityGroupCard.Providers>
                    {group.providers.slice(0, 3).map((provider) => (
                      <CapabilityGroupCard.ProviderBadge
                        key={provider.providerName}
                        name={provider.providerName}
                        toolsNumber={provider.itemCount}
                      />
                    ))}
                    <CapabilityGroupCard.MoreProviders
                      count={Math.max(0, providerCount - 3)}
                    />
                  </CapabilityGroupCard.Providers>

                  <CapabilityGroupCard.Divider />

                  <CapabilityGroupCard.Metrics>
                    {hasWildcardProvider(group) ? (
                      <span className="text-[11px] font-semibold leading-none text-[var(--text-colours-color-text-primary)]">
                        {countLabel}
                      </span>
                    ) : (
                      <CapabilityGroupCard.ToolsMetric
                        value={totalTools(group)}
                      />
                    )}
                    <CapabilityGroupCard.PromptsMetric value={0} />
                    <CapabilityGroupCard.ResourcesMetric value={0} />
                  </CapabilityGroupCard.Metrics>
                </button>

                <CapabilityGroupCard.Menu
                  open={openMenuGroupId === group.id}
                  onOpenChange={(open) =>
                    setOpenMenuGroupId(open ? group.id : null)
                  }
                >
                  <CapabilityGroupCard.MenuButton
                    aria-label={`Open ${group.name} menu`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpenMenuGroupId(group.id);
                    }}
                    onKeyDown={(event) => event.stopPropagation()}
                  />
                  <CapabilityGroupCard.MenuContent
                    onClick={(event) => event.stopPropagation()}
                  >
                    <CapabilityGroupCard.MenuItem
                      onSelect={() => onGroupClick(group)}
                    >
                      <Eye className="size-4" />
                      Details
                    </CapabilityGroupCard.MenuItem>
                    <CapabilityGroupCard.MenuItem
                      onSelect={() => onEditGroup(group)}
                    >
                      <FileEdit className="size-4" />
                      Edit Tool Group
                    </CapabilityGroupCard.MenuItem>
                    <CapabilityGroupCard.MenuItem
                      onSelect={() => onUpdateGroupItems(group)}
                    >
                      <Wrench className="size-4" />
                      Update Tools
                    </CapabilityGroupCard.MenuItem>
                    <CapabilityGroupCard.MenuItem
                      variant="destructive"
                      onSelect={() => onDeleteGroup(group)}
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </CapabilityGroupCard.MenuItem>
                  </CapabilityGroupCard.MenuContent>
                </CapabilityGroupCard.Menu>
              </CapabilityGroupCard>
            );
          })}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          {Array.from({ length: totalPages }).map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Show tool groups page ${index + 1}`}
              className={cn(
                "size-2 rounded-full transition-colors",
                index === currentGroupIndex ? "bg-primary/80" : "bg-gray-300",
              )}
              onClick={() => setCurrentGroupIndex(index)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
