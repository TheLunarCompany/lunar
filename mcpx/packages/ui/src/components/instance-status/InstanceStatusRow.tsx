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
        "flex min-w-0 items-center gap-2.5 rounded-[10px] bg-white/[0.08] px-3 py-[9px] shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.1)] backdrop-blur-[6px]",
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
        <span className="text-[12.5px] font-semibold leading-[1.2] text-white">
          {metadata.label}
        </span>
        <span className="truncate text-[11px] leading-[1.3] text-white/50">
          {metadata.description}
        </span>
      </span>
    </div>
  );
}
