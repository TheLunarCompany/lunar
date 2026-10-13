import { cn } from "@/lib/utils";
import {
  INSTANCE_STATUS_METADATA,
  type InstanceStatus,
} from "@/model/instance-status";

type InstanceStatusRowProps = {
  status: InstanceStatus;
  className?: string;
};

const dotClasses: Record<InstanceStatus, string> = {
  initializing:
    "bg-instance-status-initializing motion-safe:animate-[mcpxStatusPulse_1.4s_ease-in-out_infinite]",
  idle: "bg-instance-status-idle",
  working:
    "bg-instance-status-working motion-safe:animate-[mcpxStatusPulse_1.4s_ease-in-out_infinite]",
  error:
    "bg-instance-status-error motion-safe:animate-[mcpxStatusPulse_1.4s_ease-in-out_infinite]",
  offline: "bg-instance-status-offline",
};

export function InstanceStatusRow({
  status,
  className,
}: InstanceStatusRowProps) {
  const metadata = INSTANCE_STATUS_METADATA[status];

  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      className={cn(
        "flex min-w-0 items-center gap-2.5 rounded-[var(--border-radius-sm)] border border-[var(--mcpx-sidebar-border)] bg-[var(--mcpx-sidebar-active)] px-3 py-2 shadow-none",
        className,
      )}
      data-instance-status={status}
      role="status"
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-[7px] w-[7px] shrink-0 rounded-full",
          dotClasses[status],
        )}
        data-testid="instance-status-dot"
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs font-semibold leading-4 text-mcpx-tooltip-text">
          {metadata.label}
        </span>
        <span className="truncate text-xs leading-4 text-[var(--mcpx-sidebar-text-muted)]">
          {metadata.description}
        </span>
      </span>
    </div>
  );
}
