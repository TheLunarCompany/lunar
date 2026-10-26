import { Badge } from "@/components/ui/badge";
import { useDomainIcon } from "@/hooks/useDomainIcon";
import { cn } from "@/lib/utils";
import type { ComponentPropsWithoutRef } from "react";

export function SkillProviderBadges({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-1.5", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function SkillProviderBadge({
  name,
  isMissingOrInactive = false,
  className,
}: {
  name: string;
  isMissingOrInactive?: boolean;
  className?: string;
}) {
  const domainIconUrl = useDomainIcon(name);

  return (
    <Badge
      variant="outline"
      className={cn(
        "flex h-auto min-w-0 items-center gap-1.5 rounded border px-2 py-1.5 text-[12px] font-normal leading-none",
        isMissingOrInactive
          ? "border-mcpx-warning-strong bg-mcpx-warning-bg text-mcpx-warning-strong"
          : "border-mcpx-border-subtle bg-mcpx-surface text-mcpx-text",
        className,
      )}
    >
      {domainIconUrl && (
        <img src={domainIconUrl} alt="" aria-hidden="true" className="size-4" />
      )}
      <span className="min-w-0 truncate capitalize">{name}</span>
    </Badge>
  );
}

export function SkillMoreProviders({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (count <= 0) return null;

  return (
    <Badge
      variant="outline"
      className={cn(
        "h-auto min-w-0 rounded border-mcpx-border-subtle bg-mcpx-surface px-2 py-1.5 text-[12px] font-normal text-mcpx-text-secondary",
        className,
      )}
    >
      +{count}
    </Badge>
  );
}
