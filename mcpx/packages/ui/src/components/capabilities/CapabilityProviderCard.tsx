import { ServerStatusBadge } from "@/components/dashboard/ServerStatusBadge";
import { getMcpServerStatusFromTargetServer } from "@/components/dashboard/helpers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDomainIcon } from "@/hooks/useDomainIcon";
import { cn } from "@/lib/utils";
import type { TargetServer } from "@mcpx/shared-model";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { buildCapabilitySelectionKey } from "./capability-selection-key";
import { CapabilityPromptCard } from "./CapabilityPromptCard";
import { CapabilityToolCard } from "./CapabilityToolCard";
import HammerIcon from "./icons/hammer.svg?react";
import PromptIcon from "./icons/prompt.svg?react";
import type {
  CapabilityItem,
  CapabilityProvider,
  CapabilitySelectionKey,
} from "./types";

type CapabilityProviderCardProps = {
  provider: CapabilityProvider;
  isExpanded: boolean;
  isSelectionMode?: boolean;
  selectedCapabilityKeys?: Set<CapabilitySelectionKey>;
  onProviderClick: (providerName: string) => void;
  onCapabilitySelectionChange?: (
    item: CapabilityItem,
    providerName: string,
    isSelected: boolean,
  ) => void;
  onShowItemDetails?: (item: CapabilityItem) => void;
  onCustomizeItem?: (item: CapabilityItem) => void;
  onEditItem?: (item: CapabilityItem) => void;
  onDeleteItem?: (item: CapabilityItem) => void;
};

function capabilityProviderToTargetServer(
  provider: CapabilityProvider,
): TargetServer {
  return {
    _type: "stdio",
    name: provider.name,
    state: provider.state ?? { type: "connected" },
    command: "",
    args: [],
    env: {},
    icon: provider.icon,
    tools: [],
    originalTools: [],
    usage: { callCount: 0 },
  };
}

function TabCount({ value }: { value: number }) {
  return (
    <span className="grid size-4 place-items-center rounded-full border border-current text-[10px] leading-none">
      {value}
    </span>
  );
}

function HeaderCapabilityCount({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <span
      aria-label={`${label}: ${value}`}
      className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-colours-color-text-primary)]"
    >
      <span
        aria-hidden="true"
        className="grid size-4 place-items-center text-[var(--text-colours-color-text-secondary)] [--fill-0:currentColor] [&_svg]:size-4"
      >
        {icon}
      </span>
      <span>{value}</span>
    </span>
  );
}

export function CapabilityProviderCard({
  provider,
  isExpanded,
  isSelectionMode = false,
  selectedCapabilityKeys = new Set(),
  onProviderClick,
  onCapabilitySelectionChange,
  onShowItemDetails,
  onCustomizeItem,
  onEditItem,
  onDeleteItem,
}: CapabilityProviderCardProps) {
  const [activeTab, setActiveTab] = useState("tools");
  const domainIconUrl = useDomainIcon(provider.name);
  const status = getMcpServerStatusFromTargetServer(
    capabilityProviderToTargetServer(provider),
  );
  const toolItems = provider.items.filter((item) => item.kind === "tool");
  const promptItems = provider.items.filter((item) => item.kind === "prompt");

  const renderCapabilityItem = (item: CapabilityItem) => {
    const key = buildCapabilitySelectionKey(provider.name, item.name);
    const isSelected = selectedCapabilityKeys.has(key);
    const Card =
      item.kind === "prompt" ? CapabilityPromptCard : CapabilityToolCard;

    return (
      <Card
        key={item.id}
        item={item}
        isSelectionMode={isSelectionMode}
        isSelected={isSelected}
        onToggleSelection={() =>
          onCapabilitySelectionChange?.(item, provider.name, !isSelected)
        }
        onShowDetails={onShowItemDetails}
        onCustomizeItem={onCustomizeItem}
        onEditItem={onEditItem}
        onDeleteItem={onDeleteItem}
      />
    );
  };

  const renderCapabilityGrid = (
    items: CapabilityItem[],
    emptyMessage: string,
  ) => (
    <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.length === 0 ? (
        <div className="col-span-full py-8 text-center text-sm text-[var(--colors-gray-500)]">
          {emptyMessage}
        </div>
      ) : (
        items.map(renderCapabilityItem)
      )}
    </div>
  );

  return (
    <div
      className="rounded-lg border border-[var(--colors-gray-200)] bg-white transition-shadow hover:shadow-md"
      data-provider-name={provider.name}
    >
      <button
        type="button"
        className="flex w-full cursor-pointer items-center justify-between p-4 text-left"
        onClick={() => onProviderClick(provider.name)}
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? "Collapse" : "Expand"} ${provider.name} tools`}
      >
        <div className="flex min-w-0 items-center gap-4">
          <img
            src={domainIconUrl}
            alt={`${provider.name} favicon`}
            className="size-8 shrink-0 object-contain"
          />
          <h3 className="truncate text-lg font-semibold capitalize text-[var(--colors-gray-900)]">
            {provider.name}
          </h3>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <ServerStatusBadge status={status} />
          <div className="flex items-center gap-3">
            <HeaderCapabilityCount
              icon={<HammerIcon />}
              value={toolItems.length}
              label="Tools"
            />
            {promptItems.length > 0 && (
              <HeaderCapabilityCount
                icon={<PromptIcon />}
                value={promptItems.length}
                label="Prompts"
              />
            )}
          </div>
          <ChevronRight
            className={cn(
              "size-5 text-[var(--colors-gray-500)] transition-transform",
              isExpanded ? "rotate-90" : "",
            )}
            aria-hidden="true"
          />
        </div>
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows]",
          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="gap-0"
          >
            <div className="px-4 pt-3 border-b">
              <TabsList variant="line" className="gap-3">
                <TabsTrigger
                  value="tools"
                  className="px-0"
                  onClick={() => setActiveTab("tools")}
                >
                  Tools
                  <TabCount value={toolItems.length} />
                </TabsTrigger>
                <TabsTrigger
                  value="prompts"
                  className="px-0"
                  onClick={() => setActiveTab("prompts")}
                >
                  Prompts
                  <TabCount value={promptItems.length} />
                </TabsTrigger>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex cursor-not-allowed">
                        <TabsTrigger
                          value="resources"
                          disabled
                          className="pointer-events-none px-0"
                        >
                          Resources
                        </TabsTrigger>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent sideOffset={8}>Coming soon</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TabsList>
            </div>
            <TabsContent value="tools" className="mt-0">
              {renderCapabilityGrid(toolItems, "No tools available")}
            </TabsContent>
            <TabsContent value="prompts" className="mt-0">
              {renderCapabilityGrid(promptItems, "No prompts available")}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
