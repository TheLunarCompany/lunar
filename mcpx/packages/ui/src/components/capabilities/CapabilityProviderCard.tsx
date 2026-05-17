import { ServerStatusBadge } from "@/components/dashboard/ServerStatusBadge";
import McpIcon from "@/components/dashboard/SystemConnectivity/nodes/Mcpx_Icon.svg?react";
import { getMcpServerStatusFromTargetServer } from "@/components/dashboard/helpers";
import { useDomainIcon } from "@/hooks/useDomainIcon";
import { cn } from "@/lib/utils";
import type { TargetServer } from "@mcpx/shared-model";
import { ChevronRight } from "lucide-react";
import { buildCapabilitySelectionKey } from "./capability-selection-key";
import { CapabilityCatalogItemCard } from "./CapabilityCatalogItemCard";
import type {
  CapabilityItem,
  CapabilityProvider,
  CapabilitySelectionKey,
} from "./types";

type CapabilityProviderCardProps = {
  provider: CapabilityProvider;
  isExpanded: boolean;
  isSelectionMode?: boolean;
  isAddCustomToolMode?: boolean;
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

export function CapabilityProviderCard({
  provider,
  isExpanded,
  isSelectionMode = false,
  isAddCustomToolMode = false,
  selectedCapabilityKeys = new Set(),
  onProviderClick,
  onCapabilitySelectionChange,
  onShowItemDetails,
  onCustomizeItem,
  onEditItem,
  onDeleteItem,
}: CapabilityProviderCardProps) {
  const domainIconUrl = useDomainIcon(provider.name);
  const status = getMcpServerStatusFromTargetServer(
    capabilityProviderToTargetServer(provider),
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
          {domainIconUrl ? (
            <img
              src={domainIconUrl}
              alt={`${provider.name} favicon`}
              className="size-8 shrink-0 object-contain"
            />
          ) : (
            <McpIcon
              role="img"
              aria-label={`${provider.name} fallback logo`}
              className="size-8 shrink-0 text-[var(--colors-gray-600)]"
              style={{ color: provider.icon }}
            />
          )}
          <h3 className="truncate text-lg font-semibold capitalize text-[var(--colors-gray-900)]">
            {provider.name}
          </h3>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <ServerStatusBadge status={status} />
          <span className="text-sm text-[var(--colors-gray-600)]">
            {provider.items.length} tool{provider.items.length === 1 ? "" : "s"}
          </span>
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
        <div className="min-h-0 overflow-hidden border-t border-[var(--colors-gray-100)]">
          <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {provider.items.length === 0 ? (
              <div className="col-span-full py-8 text-center text-sm text-[var(--colors-gray-500)]">
                No tools available
              </div>
            ) : (
              provider.items.map((item) => {
                const key = buildCapabilitySelectionKey(
                  provider.name,
                  item.name,
                );
                const isSelected = selectedCapabilityKeys.has(key);
                const selectionLocked =
                  isAddCustomToolMode &&
                  selectedCapabilityKeys.size > 0 &&
                  !isSelected;

                return (
                  <CapabilityCatalogItemCard
                    key={item.id}
                    item={item}
                    isSelectionMode={isSelectionMode}
                    isAddCustomToolMode={isAddCustomToolMode}
                    isSelected={isSelected}
                    selectionLocked={selectionLocked}
                    onToggleSelection={() =>
                      onCapabilitySelectionChange?.(
                        item,
                        provider.name,
                        !isSelected,
                      )
                    }
                    onShowDetails={onShowItemDetails}
                    onCustomizeItem={onCustomizeItem}
                    onEditItem={onEditItem}
                    onDeleteItem={onDeleteItem}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
