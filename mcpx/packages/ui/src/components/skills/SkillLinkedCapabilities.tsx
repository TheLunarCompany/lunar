import { CapabilityItemCard } from "@/components/capabilities/CapabilityItemCard";
import GitBranchIcon from "@/components/capabilities/icons/git-branch-01.svg?react";
import PromptIcon from "@/components/capabilities/icons/prompt.svg?react";
import { Button } from "@/components/ui/button";
import ServerIconSvg from "@/icons/server_icon.svg?react";
import { cn } from "@/lib/utils";
import type { SkillCapabilityGroup, SystemState } from "@mcpx/shared-model";
import type { CatalogMCPServerConfigByNameList } from "@mcpx/toolkit-ui/src/utils/server-helpers";
import { Pencil, Unplug } from "lucide-react";
import { SkillCardMetrics } from "./SkillCardMetrics";
import { SkillProviderBadge } from "./SkillProviderBadge";
import { SkillSectionCard } from "./SkillSectionCard";

type SkillLinkedCapabilitiesProps = React.ComponentProps<"section"> & {
  capabilityGroup?: SkillCapabilityGroup;
  systemState?: SystemState | null;
  catalogItems?: CatalogMCPServerConfigByNameList;
  onEdit?: () => void;
  showEmptyState?: boolean;
};

type LinkedProvider = {
  id: string;
  name: string;
  tools: LinkedCapability[];
  prompts: LinkedCapability[];
  unavailable: boolean;
};

type LinkedCapability = {
  name: string;
  unavailable: boolean;
};

const unavailableBadgeClassName =
  "border border-[var(--colors-warning-300)] bg-[var(--colors-warning-50)] text-[var(--colors-warning-700)]";

export function SkillLinkedCapabilities({
  capabilityGroup,
  systemState,
  catalogItems,
  onEdit,
  showEmptyState = false,
  className,
  ...props
}: SkillLinkedCapabilitiesProps) {
  const providers = buildLinkedProviders({
    capabilityGroup,
    systemState,
    catalogItems,
  });
  const toolsCount = providers.reduce(
    (total, provider) => total + provider.tools.length,
    0,
  );
  const promptsCount = providers.reduce(
    (total, provider) => total + provider.prompts.length,
    0,
  );

  if (providers.length === 0) {
    if (showEmptyState) {
      return (
        <section
          className={cn(
            "overflow-hidden rounded-xl border border-[var(--colors-gray-200)] bg-[var(--colors-gray-50)] shadow-sm",
            className,
          )}
          {...props}
        >
          {onEdit ? (
            <div className="flex justify-end border-b border-[var(--colors-gray-200)] bg-[var(--colors-gray-100)] px-4 py-3">
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-lg px-3"
                onClick={onEdit}
              >
                <Pencil />
                Edit
              </Button>
            </div>
          ) : null}
          <div className="flex min-h-80 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
            <span aria-hidden="true">
              <ServerIconSvg className="h-40 w-auto" />
            </span>
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-[var(--text-colours-color-text-primary)]">
                No servers connected yet. Click here to connect servers to your
                MCPX instance.
              </h2>
              <p className="text-sm text-[var(--text-colours-color-text-secondary)]">
                Add an MCP server to make tools and prompts available for this
                skill.
              </p>
            </div>
          </div>
        </section>
      );
    }

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
              <SkillProviderBadge
                name={provider.name}
                isMissingOrInactive={provider.unavailable}
              />
              <span className="shrink-0 text-xs text-[var(--text-colours-color-text-secondary)]">
                {provider.unavailable
                  ? `${Math.max(provider.tools.length + provider.prompts.length, 1)} unavailable`
                  : `${provider.tools.length + provider.prompts.length} linked`}
              </span>
            </div>
            <div className="mt-2 flex flex-col gap-2">
              {provider.unavailable &&
              provider.tools.length === 0 &&
              provider.prompts.length === 0 ? (
                <p className="text-sm text-[var(--text-colours-color-text-secondary)]">
                  Capability details unavailable
                </p>
              ) : null}
              <CapabilityBadges
                capabilities={provider.tools}
                icon={<GitBranchIcon aria-label="Capability type icon" />}
                providerId={provider.id}
                kind="tool"
              />
              <CapabilityBadges
                capabilities={provider.prompts}
                icon={<PromptIcon />}
                providerId={provider.id}
                kind="prompt"
              />
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
  catalogItems,
}: {
  capabilityGroup?: SkillCapabilityGroup;
  systemState?: SystemState | null;
  catalogItems?: CatalogMCPServerConfigByNameList;
}): LinkedProvider[] {
  const serversByCatalogItemId = new Map(
    (systemState?.targetServers ?? [])
      .filter((server) => server.catalogItemId)
      .map((server) => [server.catalogItemId!, server]),
  );
  const catalogItemsById = new Map(
    (catalogItems ?? []).map((item) => [item.id, item]),
  );

  return (capabilityGroup?.items ?? []).map((item) => {
    const server = serversByCatalogItemId.get(item.catalogItemId);

    if (!server) {
      return {
        id: item.catalogItemId,
        name:
          getCatalogItemLabel(catalogItemsById.get(item.catalogItemId)) ??
          "Unavailable MCP server",
        tools: getUnavailableSelectionNames(item.tools),
        prompts: getUnavailableSelectionNames(item.prompts),
        unavailable: true,
      };
    }

    return {
      id: item.catalogItemId,
      name: server.name,
      tools: getSelectionNames(
        item.tools,
        server.tools.map((tool) => tool.name),
      ).map((name) => ({ name, unavailable: false })),
      prompts: getSelectionNames(
        item.prompts,
        server.prompts?.map((prompt) => prompt.name),
      ).map((name) => ({ name, unavailable: false })),
      unavailable: false,
    };
  });
}

function getCatalogItemLabel(
  item: CatalogMCPServerConfigByNameList[number] | undefined,
) {
  return item?.displayName || item?.name;
}

function getSelectionNames(
  selection: string[] | "*",
  wildcardNames?: string[],
) {
  return selection === "*" ? (wildcardNames ?? []) : selection;
}

function getUnavailableSelectionNames(selection: string[] | "*") {
  return selection === "*"
    ? []
    : selection.map((name) => ({ name, unavailable: true }));
}

function CapabilityBadges({
  capabilities,
  icon,
  kind,
  providerId,
}: {
  capabilities: LinkedCapability[];
  icon: React.ReactNode;
  kind: "tool" | "prompt";
  providerId: string;
}) {
  if (capabilities.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-start gap-2">
      {capabilities.map((capability) => (
        <div
          key={`${providerId}:${kind}:${capability.name}`}
          className="flex flex-col items-start gap-1"
        >
          <CapabilityItemCard.TitleBadge
            size="sm"
            icon={icon}
            className={
              capability.unavailable ? unavailableBadgeClassName : undefined
            }
          >
            {capability.name}
          </CapabilityItemCard.TitleBadge>
        </div>
      ))}
    </div>
  );
}
