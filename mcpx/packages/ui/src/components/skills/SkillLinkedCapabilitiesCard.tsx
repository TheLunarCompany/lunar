import type { CapabilityProvider } from "@/components/capabilities/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDomainIcon } from "@/hooks/useDomainIcon";
import { Link2, X } from "lucide-react";
import {
  SkillSidebarCardActionButton,
  SkillSidebarCardContent,
  SkillSidebarCardHeader,
  SkillSidebarCardRoot,
  SkillSidebarCardRow,
  SkillSidebarCardRowButton,
  SkillSidebarCardTitle,
} from "./SkillSidebarCard";

export type SkillLinkedCapabilityProvider = {
  provider: CapabilityProvider;
  selectedCount: number;
};

export function SkillLinkedCapabilitiesCard({
  providers,
  activeProviderNames,
  onProviderClick,
  onProviderUnlink,
  onLinkCapabilities,
}: {
  providers: SkillLinkedCapabilityProvider[];
  activeProviderNames?: string[];
  onProviderClick?: (provider: CapabilityProvider) => void;
  onProviderUnlink?: (provider: CapabilityProvider) => void;
  onLinkCapabilities?: () => void;
}) {
  const activeProviderNameSet = new Set(activeProviderNames ?? []);

  return (
    <SkillSidebarCardRoot data-testid="linked-mcp-capabilities">
      <SkillSidebarCardHeader>
        <SkillSidebarCardTitle>Linked MCP capabilities</SkillSidebarCardTitle>
      </SkillSidebarCardHeader>

      <SkillSidebarCardContent>
        {providers.length === 0 ? (
          <p className="py-2 text-sm text-[var(--text-colours-color-text-secondary)]">
            No MCP servers linked yet.
          </p>
        ) : (
          providers.map(({ provider, selectedCount }) => (
            <LinkedProviderRow
              key={provider.catalogItemId ?? provider.name}
              provider={provider}
              selectedCount={selectedCount}
              isActive={activeProviderNameSet.has(provider.name)}
              onProviderClick={onProviderClick}
              onProviderUnlink={onProviderUnlink}
            />
          ))
        )}
      </SkillSidebarCardContent>
      {onLinkCapabilities ? (
        <SkillSidebarCardActionButton onClick={onLinkCapabilities}>
          <Link2 aria-hidden="true" />
          Edit MCP capabilities
        </SkillSidebarCardActionButton>
      ) : null}
    </SkillSidebarCardRoot>
  );
}

function LinkedProviderRow({
  provider,
  selectedCount,
  isActive,
  onProviderClick,
  onProviderUnlink,
}: {
  provider: CapabilityProvider;
  selectedCount: number;
  isActive: boolean;
  onProviderClick?: (provider: CapabilityProvider) => void;
  onProviderUnlink?: (provider: CapabilityProvider) => void;
}) {
  const iconSrc = useDomainIcon(provider.name);

  return (
    <SkillSidebarCardRow variant={isActive ? "active" : "default"}>
      {onProviderClick ? (
        <SkillSidebarCardRowButton
          className="flex min-w-0 flex-1 items-center gap-2 rounded-sm text-left text-sm text-[var(--text-colours-color-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Filter by ${provider.name}`}
          aria-pressed={isActive}
          onClick={() => onProviderClick(provider)}
        >
          <ProviderRowContent
            provider={provider}
            iconSrc={iconSrc}
            selectedCount={selectedCount}
          />
        </SkillSidebarCardRowButton>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2 text-sm text-[var(--text-colours-color-text-primary)]">
          <ProviderRowContent
            provider={provider}
            iconSrc={iconSrc}
            selectedCount={selectedCount}
          />
        </div>
      )}
      {onProviderUnlink ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-7 text-[var(--colors-gray-600)]"
          aria-label={`Unlink ${provider.name} capabilities`}
          onClick={() => onProviderUnlink(provider)}
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      ) : null}
    </SkillSidebarCardRow>
  );
}

function ProviderRowContent({
  provider,
  iconSrc,
  selectedCount,
}: {
  provider: CapabilityProvider;
  iconSrc?: string;
  selectedCount: number;
}) {
  return (
    <>
      <ProviderIcon name={provider.name} iconSrc={iconSrc} />
      <span className="min-w-0 flex-1 truncate capitalize">
        {provider.name}
      </span>
      <Badge variant="purple" size="sm">
        {selectedCount}
      </Badge>
    </>
  );
}

function ProviderIcon({ name, iconSrc }: { name: string; iconSrc?: string }) {
  if (iconSrc) {
    return <img src={iconSrc} alt="" aria-hidden="true" className="size-5" />;
  }

  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-[var(--colors-gray-900)] text-[11px] font-semibold uppercase text-[var(--colors-gray-50)]">
      {name.slice(0, 1)}
    </span>
  );
}
