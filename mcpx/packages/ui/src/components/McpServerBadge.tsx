import { Badge } from "@/components/ui/badge";
import { useDomainIcon } from "@/hooks/useDomainIcon";
import { cn } from "@/lib/utils";
import type { ComponentPropsWithoutRef } from "react";

export function McpServerBadges({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-1", className)}
      {...props}
    >
      {children}
    </div>
  );
}

type McpServerBadgeProps = {
  name: string;
  count?: number;
  className?: string;
};

export function McpServerBadge({
  name,
  count,
  className,
}: McpServerBadgeProps) {
  const domainIconUrl = useDomainIcon(name);

  return (
    <Badge
      variant="outline"
      className={cn(
        "flex h-6 items-center gap-1 rounded-[4px] border border-[var(--mcpx-border-subtle)] bg-[var(--mcpx-surface)] px-1 py-0 text-[11px] font-normal leading-[15px] text-[var(--mcpx-text-secondary)]",
        className,
      )}
    >
      {domainIconUrl && (
        <img src={domainIconUrl} alt="" aria-hidden="true" className="size-4" />
      )}
      <span className="capitalize">{name}</span>
      {count != null ? (
        <Badge
          variant="outline"
          className="h-auto rounded-[16px] border border-[var(--mcpx-border-subtle)] bg-[var(--mcpx-surface-subtle)] px-[6px] py-0 text-xs font-normal leading-[18px] text-[var(--mcpx-text-secondary)]"
        >
          {count}
        </Badge>
      ) : null}
    </Badge>
  );
}
