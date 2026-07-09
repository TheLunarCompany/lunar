import { Badge } from "@/components/ui/badge";
import type { SkillCapabilityGroup } from "@mcpx/shared-model";

type SkillToolGroupSummaryProps = {
  capabilityGroup?: SkillCapabilityGroup;
};

export function SkillToolGroupSummary({
  capabilityGroup,
}: SkillToolGroupSummaryProps) {
  if (!capabilityGroup) {
    return null;
  }

  return (
    <div className="space-y-2">
      {capabilityGroup.name ? (
        <Badge variant="outline" className="rounded-md">
          {capabilityGroup.name}
        </Badge>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {capabilityGroup.items.map((item) => (
          <div
            key={item.catalogItemId}
            className="flex max-w-full items-center gap-1 rounded-md border border-[var(--structure-color-border-primary)] bg-[var(--structure-color-bg-container-overlay)] px-2 py-1 text-xs text-[var(--text-colours-color-text-secondary)]"
          >
            <span className="truncate font-medium text-[var(--text-colours-color-text-primary)]">
              {item.catalogItemId}
            </span>
            <span className="text-[var(--text-colours-color-text-tertiary)]">
              {item.tools === "*" ? "*" : item.tools.join(", ")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
