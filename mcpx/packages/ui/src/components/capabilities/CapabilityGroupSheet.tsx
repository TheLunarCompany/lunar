import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDomainIcon } from "@/hooks/useDomainIcon";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileEdit, Search, Trash2, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import McpIcon from "../dashboard/SystemConnectivity/nodes/Mcpx_Icon.svg?react";
import { buildCapabilitySelectionKey } from "./capability-selection-key";
import { CapabilityGroupCard } from "./CapabilityGroupCard";
import { CapabilityPromptCard } from "./CapabilityPromptCard";
import { CapabilityToolCard } from "./CapabilityToolCard";
import type {
  CapabilityKind,
  CapabilityGroup,
  CapabilityItem,
  CapabilityProvider,
} from "./types";

type CapabilityTab = CapabilityKind | "resources";

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

function TabCount({ value }: { value: number }) {
  return (
    <span className="grid size-4 place-items-center rounded-full border border-current text-[10px] font-medium leading-none">
      {value}
    </span>
  );
}

function itemMatchesSearch(
  item: CapabilityItem,
  providerName: string,
  searchValue: string,
) {
  const normalizedSearch = searchValue.trim().toLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  return [item.name, item.description, providerName].some((value) =>
    value.toLowerCase().includes(normalizedSearch),
  );
}

function hasMatchesForKind(
  providerItems: ReturnType<typeof findGroupItems>,
  kind: CapabilityKind,
  searchValue: string,
) {
  return providerItems.some(({ providerName, items }) =>
    items.some(
      (item) =>
        item.kind === kind &&
        itemMatchesSearch(item, providerName, searchValue),
    ),
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
  const providerItems = useMemo(
    () => (group ? findGroupItems(group, providers) : []),
    [group, providers],
  );
  const [activeTab, setActiveTab] = useState<CapabilityTab>("tool");
  const [searchValue, setSearchValue] = useState("");
  const allItems = useMemo(
    () => providerItems.flatMap(({ items }) => items),
    [providerItems],
  );
  const toolCount = allItems.filter((item) => item.kind === "tool").length;
  const promptCount = allItems.filter((item) => item.kind === "prompt").length;
  const handleSearchChange = (value: string) => {
    setSearchValue(value);

    if (!value.trim() || activeTab === "resources") {
      return;
    }

    const activeTabHasMatches = hasMatchesForKind(
      providerItems,
      activeTab,
      value,
    );

    if (activeTabHasMatches) {
      return;
    }

    if (
      activeTab === "tool" &&
      hasMatchesForKind(providerItems, "prompt", value)
    ) {
      setActiveTab("prompt");
      return;
    }

    if (
      activeTab === "prompt" &&
      hasMatchesForKind(providerItems, "tool", value)
    ) {
      setActiveTab("tool");
    }
  };
  const visibleProviderItems = providerItems
    .map(({ provider, providerName, items }) => ({
      provider,
      providerName,
      items: items.filter(
        (item) =>
          activeTab !== "resources" &&
          item.kind === activeTab &&
          itemMatchesSearch(item, providerName, searchValue),
      ),
    }))
    .filter(({ items }) => items.length > 0);
  const activeEmptyMessage =
    activeTab === "prompt"
      ? searchValue.trim()
        ? "No prompts match your search."
        : "This tool group has no prompts."
      : searchValue.trim()
        ? "No tools match your search."
        : "This tool group has no tools.";

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-[625px] max-w-[625px]! gap-0 overflow-x-hidden border-l border-[var(--colors-gray-200)] bg-[var(--colors-white)] p-0 shadow-[-2px_0_25px_0_rgba(0,0,0,0.09)]"
      >
        <SheetHeader className="mx-auto w-full max-w-[550px] gap-4 px-0 pb-4 pt-6">
          <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] gap-x-2 gap-y-0.5">
            <CapabilityGroupCard.Icon className="size-10 border border-[var(--structure-color-border-primary)]" />
            <div className="col-start-2 min-w-0">
              <SheetTitle className="truncate text-[15px] font-medium leading-[1.34] tracking-[0] text-[var(--text-colours-color-text-primary)]">
                {group?.name ?? "No tool group selected"}
              </SheetTitle>
            </div>
            {group && (
              <div className="col-start-3 row-start-1 flex shrink-0 items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded text-[var(--text-colours-color-text-secondary)]"
                  onClick={() => onEditGroup(group)}
                  aria-label="Edit Tool Group"
                >
                  <FileEdit className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded text-[var(--text-colours-color-text-secondary)]"
                  onClick={() => onUpdateGroupItems(group)}
                  aria-label="Update Tools"
                >
                  <Wrench className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded text-[var(--text-colours-color-text-secondary)]"
                  onClick={() => onDeleteGroup(group)}
                  aria-label="Delete"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            )}
            <SheetDescription
              data-capability-group-sheet-description
              className="col-start-2 col-end-4 row-start-2 line-clamp-2 text-[13px] leading-[1.34] tracking-[0] text-[var(--text-colours-color-text-secondary)]"
            >
              {group?.description}
            </SheetDescription>
          </div>
          {group && (
            <CapabilityGroupCard.Providers>
              {group.providers.map((providerSummary) => (
                <CapabilityGroupCard.ProviderBadge
                  key={providerSummary.providerName}
                  name={providerSummary.providerName}
                  toolsNumber={providerSummary.itemCount}
                />
              ))}
            </CapabilityGroupCard.Providers>
          )}
        </SheetHeader>

        {!group ? (
          <div className="mx-auto w-full max-w-[550px] py-8 text-sm text-[var(--colors-gray-600)]">
            Choose a tool group to view details.
          </div>
        ) : providerItems.length === 0 ? (
          <div className="mx-auto w-full max-w-[550px] py-8 text-sm text-[var(--colors-gray-600)]">
            This tool group has no tools.
          </div>
        ) : (
          <div
            data-capability-group-sheet-body
            className="mx-auto flex min-h-0 w-full max-w-[550px] flex-1 flex-col gap-4 pb-2"
          >
            <div className="relative shrink-0">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[var(--text-colours-color-text-secondary)]"
                aria-hidden="true"
              />
              <Input
                type="search"
                aria-label="Search tools and prompts"
                placeholder="Search..."
                value={searchValue}
                onChange={(event) => handleSearchChange(event.target.value)}
                className="h-10 rounded-lg border-[var(--structure-color-border-primary)] bg-[var(--colors-white)] pl-11 pr-4 text-sm tracking-[0] placeholder:text-[var(--colors-gray-400)]"
              />
            </div>
            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as CapabilityTab)}
              className="min-h-0 flex-1 gap-0"
            >
              <div className="border-b border-[var(--structure-color-border-primary)]">
                <TabsList variant="line" className="gap-3">
                  <TabsTrigger
                    value="tool"
                    className="px-4"
                    onClick={() => setActiveTab("tool")}
                  >
                    Tools
                    <TabCount value={toolCount} />
                  </TabsTrigger>
                  <TabsTrigger
                    value="prompt"
                    className="px-4"
                    onClick={() => setActiveTab("prompt")}
                  >
                    Prompts
                    <TabCount value={promptCount} />
                  </TabsTrigger>
                  <TabsTrigger value="resources" disabled className="px-4">
                    Resources
                    <TabCount value={0} />
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent
                value="tool"
                className="mt-4 min-h-0 overflow-y-auto pr-1"
              >
                {visibleProviderItems.length === 0 ? (
                  <div className="py-8 text-sm text-[var(--colors-gray-600)]">
                    {activeEmptyMessage}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {visibleProviderItems.map(
                      ({ provider, providerName, items }) => (
                        <section
                          key={providerName}
                          className="space-y-2 rounded-lg border border-[var(--structure-color-border-primary)] bg-[var(--colors-white)] p-3"
                        >
                          <div className="flex items-center gap-2">
                            <ProviderIcon
                              provider={provider}
                              providerName={providerName}
                            />
                            <h3 className="truncate text-xl font-medium leading-none tracking-[0] text-[var(--text-colours-color-text-primary)]">
                              {providerName}
                            </h3>
                          </div>
                          <div className="space-y-2">
                            {items.map((item) =>
                              item.kind === "prompt" ? (
                                <CapabilityPromptCard
                                  key={item.id}
                                  item={item}
                                  className="w-full"
                                  onShowDetails={onShowItemDetails}
                                  showActions={false}
                                />
                              ) : (
                                <CapabilityToolCard
                                  key={item.id}
                                  item={item}
                                  className="w-full"
                                  onShowDetails={onShowItemDetails}
                                  showActions={false}
                                />
                              ),
                            )}
                          </div>
                          <p className="text-xs leading-none text-[var(--text-colours-color-text-secondary)]">
                            {items.length}{" "}
                            {activeTab === "prompt" ? "prompt" : "tool"}
                            {items.length === 1 ? "" : "s"}
                          </p>
                        </section>
                      ),
                    )}
                  </div>
                )}
              </TabsContent>
              <TabsContent
                value="prompt"
                className="mt-4 min-h-0 overflow-y-auto pr-1"
              >
                {visibleProviderItems.length === 0 ? (
                  <div className="py-8 text-sm text-[var(--colors-gray-600)]">
                    {activeEmptyMessage}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {visibleProviderItems.map(
                      ({ provider, providerName, items }) => (
                        <section
                          key={providerName}
                          className="space-y-2 rounded-lg border border-[var(--structure-color-border-primary)] bg-[var(--colors-white)] p-3"
                        >
                          <div className="flex items-center gap-2">
                            <ProviderIcon
                              provider={provider}
                              providerName={providerName}
                            />
                            <h3 className="truncate text-xl font-medium leading-none tracking-[0] text-[var(--text-colours-color-text-primary)]">
                              {providerName}
                            </h3>
                          </div>
                          <div className="space-y-2">
                            {items.map((item) => (
                              <CapabilityPromptCard
                                key={item.id}
                                item={item}
                                className="w-full"
                                onShowDetails={onShowItemDetails}
                                showActions={false}
                              />
                            ))}
                          </div>
                          <p className="text-xs leading-none text-[var(--text-colours-color-text-secondary)]">
                            {items.length} prompt
                            {items.length === 1 ? "" : "s"}
                          </p>
                        </section>
                      ),
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
