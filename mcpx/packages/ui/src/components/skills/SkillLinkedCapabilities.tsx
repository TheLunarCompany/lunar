import { CapabilityItemCard } from "@/components/capabilities/CapabilityItemCard";
import GitBranchIcon from "@/components/capabilities/icons/git-branch-01.svg?react";
import PromptIcon from "@/components/capabilities/icons/prompt.svg?react";
import { Button } from "@/components/ui/button";
import { useDomainIcon } from "@/hooks/useDomainIcon";
import type { SkillCapabilityGroup, SystemState } from "@mcpx/shared-model";
import { Pencil, Unplug } from "lucide-react";
import { SkillCardMetrics } from "./SkillCardMetrics";
import { SkillSectionCard } from "./SkillSectionCard";

type SkillLinkedCapabilitiesProps = React.ComponentProps<"section"> & {
  capabilityGroup?: SkillCapabilityGroup;
  systemState?: SystemState | null;
  onEdit?: () => void;
};

type LinkedProvider = {
  id: string;
  name: string;
  tools: string[];
  prompts: string[];
};

export function SkillLinkedCapabilities({
  capabilityGroup,
  systemState,
  onEdit,
  className,
  ...props
}: SkillLinkedCapabilitiesProps) {
  const providers = buildLinkedProviders({ capabilityGroup, systemState });
  const toolsCount = getCapabilitySelectionTotal(
    capabilityGroup?.items.map((item) => item.tools),
  );
  const promptsCount = getCapabilitySelectionTotal(
    capabilityGroup?.items.map((item) => item.prompts),
  );

  if (providers.length === 0) {
    return null;
  }

  return (
    <SkillSectionCard
      icon={<Unplug className="size-4" />}
      title="Linked MCP capabilities"
      description={capabilityGroup?.name ?? "Tools and prompts"}
      actions={
        <div className="flex items-center gap-3">
          <SkillCardMetrics
            toolsCount={toolsCount}
            promptsCount={promptsCount}
          />
          {onEdit ? (
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-lg px-3"
              onClick={onEdit}
            >
              <Pencil />
              Edit
            </Button>
          ) : null}
        </div>
      }
      className={className}
      contentClassName="p-5"
      {...props}
    >
      <div className="flex flex-col gap-4">
        {providers.map((provider) => (
          <div key={provider.id} className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <ProviderIcon name={provider.name} />
              <div className="flex min-w-0 items-center gap-2">
                <h3 className="truncate text-sm font-semibold capitalize text-[var(--text-colours-color-text-primary)]">
                  {provider.name}
                </h3>
                <span className="shrink-0 text-xs text-[var(--text-colours-color-text-secondary)]">
                  {provider.tools.length + provider.prompts.length} linked
                </span>
              </div>
            </div>
            <div className="mt-2 flex flex-col gap-2">
              {provider.tools.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  {provider.tools.map((name) => (
                    <CapabilityItemCard.TitleBadge
                      key={`${provider.id}:tool:${name}`}
                      size="sm"
                      icon={<GitBranchIcon aria-label="Capability type icon" />}
                    >
                      {name}
                    </CapabilityItemCard.TitleBadge>
                  ))}
                </div>
              ) : null}
              {provider.prompts.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  {provider.prompts.map((name) => (
                    <CapabilityItemCard.TitleBadge
                      key={`${provider.id}:prompt:${name}`}
                      size="sm"
                      icon={<PromptIcon />}
                    >
                      {name}
                    </CapabilityItemCard.TitleBadge>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </SkillSectionCard>
  );
}

function buildLinkedProviders({
  capabilityGroup,
  systemState,
}: {
  capabilityGroup?: SkillCapabilityGroup;
  systemState?: SystemState | null;
}): LinkedProvider[] {
  const serversByCatalogItemId = new Map(
    (systemState?.targetServers ?? [])
      .filter((server) => server.catalogItemId)
      .map((server) => [server.catalogItemId!, server]),
  );

  return (capabilityGroup?.items ?? []).map((item) => {
    const server = serversByCatalogItemId.get(item.catalogItemId);

    return {
      id: item.catalogItemId,
      name: server?.name ?? item.catalogItemId,
      tools: getSelectionNames(
        item.tools,
        server?.tools.map((tool) => tool.name),
      ),
      prompts: getSelectionNames(
        item.prompts,
        server?.prompts?.map((prompt) => prompt.name),
      ),
    };
  });
}

function getSelectionNames(
  selection: string[] | "*",
  wildcardNames?: string[],
) {
  return selection === "*" ? (wildcardNames ?? ["*"]) : selection;
}

function getCapabilitySelectionTotal(
  selections: Array<string[] | "*"> | undefined,
) {
  return (selections ?? []).reduce((total, selection) => {
    if (selection === "*") {
      return total;
    }
    return total + selection.length;
  }, 0);
}

function ProviderIcon({ name }: { name: string }) {
  const iconUrl = useDomainIcon(name);

  if (iconUrl) {
    return (
      <span
        aria-hidden="true"
        className="grid size-7 place-items-center rounded-md bg-[var(--colors-white)]"
      >
        <img src={iconUrl} alt="" className="size-6 rounded object-contain" />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className="grid size-7 place-items-center rounded-md bg-[var(--colors-gray-900)] text-xs font-semibold text-[var(--colors-white)]"
    >
      {getProviderInitial(name)}
    </span>
  );
}

function getProviderInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}
