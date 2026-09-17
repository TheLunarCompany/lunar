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
        "relative flex h-[116px] min-w-0 rounded-[var(--border-radius-lg)] bg-[linear-gradient(135deg,var(--colors-dashboard-metric-card-start)_0%,var(--colors-dashboard-metric-card-end)_100%)] p-4",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-1 flex-col justify-between pr-8">
        <div
          data-slot="metric-card-label"
          className="truncate text-[13px] leading-4 font-normal text-[var(--colors-gray-600)]"
        >
          {label}
        </div>
        <div
          data-slot="metric-card-value"
          className="truncate text-[28px] leading-10 font-semibold text-[var(--colors-gray-950)] tabular-nums"
        >
          {value}
        </div>
      </div>
      <div
        data-slot="metric-card-icon"
        className="absolute top-4 right-4 flex size-8 items-center justify-center rounded-[var(--border-radius-md)] border border-[var(--colors-dashboard-metric-card-icon-border)] bg-[var(--colors-dashboard-metric-card-icon-bg)] text-[var(--colors-gray-950)]"
      >
        {icon}
      </div>
    </div>
  );
}

export { MetricCard };
export type { MetricCardProps };
