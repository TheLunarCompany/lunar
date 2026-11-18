import * as React from "react";

import { cn } from "@/lib/utils";

type MetricCardProps = React.ComponentProps<"div"> & {
  icon: React.ReactNode;
  label: React.ReactNode;
  value: React.ReactNode;
};

function MetricCard({
  className,
  icon,
  label,
  value,
  ...props
}: MetricCardProps) {
  return (
    <div
      data-slot="metric-card"
      className={cn(
        "flex h-[116px] min-w-0 flex-col gap-3 rounded-[var(--border-radius-lg)] bg-mcpx-selected-weak p-4",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-center justify-between gap-3 overflow-hidden">
        <div
          data-slot="metric-card-label"
          className="truncate text-sm leading-6 font-normal tracking-[-0.02em] text-mcpx-text-secondary"
        >
          {label}
        </div>
        <div
          data-slot="metric-card-icon"
          className="flex size-[26px] shrink-0 items-center justify-center rounded-[var(--border-radius-sm)] border border-mcpx-surface-tertiary bg-[var(--mcpx-metric-icon)] text-mcpx-text"
        >
          {icon}
        </div>
      </div>
      <div
        data-slot="metric-card-value"
        className="min-w-0 truncate text-[40px] leading-[1.25] font-bold text-mcpx-text tabular-nums"
      >
        {value}
      </div>
    </div>
  );
}

export { MetricCard };
export type { MetricCardProps };
