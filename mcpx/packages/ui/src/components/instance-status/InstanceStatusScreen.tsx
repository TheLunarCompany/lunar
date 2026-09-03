import { CircleAlert, Unplug } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  INSTANCE_STATUS_PANEL_METADATA,
  type PanelStatus,
} from "@/model/instance-status";
import Rocket from "./Rocket.gif";

type InstanceStatusScreenProps = {
  status: PanelStatus;
  className?: string;
};

const artworkClasses: Record<PanelStatus, string> = {
  initializing:
    "overflow-hidden bg-instance-status-initializing-artwork text-instance-status-initializing",
  error: "bg-instance-status-error-artwork text-instance-status-error",
  offline: "bg-instance-status-artwork text-instance-status-offline",
};

const badgeClasses: Record<PanelStatus, string> = {
  initializing:
    "bg-instance-status-initializing-artwork text-instance-status-initializing",
  error: "bg-instance-status-error-artwork text-instance-status-error",
  offline: "bg-instance-status-artwork text-instance-status-offline",
};

export function InstanceStatusScreen({
  status,
  className,
}: InstanceStatusScreenProps) {
  const metadata = INSTANCE_STATUS_PANEL_METADATA[status];
  const artwork = getArtwork(status);

  return (
    <section
      aria-label={metadata.title}
      className={cn(
        "flex min-h-0 flex-1 items-center justify-center overflow-auto bg-instance-status-panel-background p-6 text-center sm:p-8",
        className,
      )}
      data-instance-status={status}
      data-testid="instance-status-screen"
    >
      <div className="flex w-full max-w-2xl flex-col items-center gap-6 rounded-3xl border border-instance-status-panel-border bg-instance-status-panel-surface px-6 py-12 shadow-[0_12px_32px_rgb(30_27_75_/_0.06)] sm:px-10 sm:py-16">
        <div
          aria-hidden="true"
          className={cn(
            "grid size-24 shrink-0 place-items-center rounded-full sm:size-[104px]",
            artworkClasses[status],
          )}
        >
          {artwork.kind === "rocket" ? (
            <img
              src={Rocket}
              alt=""
              className="h-full w-full -translate-y-[15px] object-cover object-center"
            />
          ) : (
            <artwork.Icon className="size-10 stroke-[1.8]" />
          )}
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-[11px] font-bold leading-none tracking-[0.12em]",
            badgeClasses[status],
          )}
        >
          {metadata.label}
        </span>
        <div className="flex max-w-prose flex-col gap-3">
          <h1 className="m-0 text-xl font-semibold leading-tight text-instance-status-panel-heading sm:text-2xl">
            {metadata.title}
          </h1>
          <p className="m-0 text-sm leading-6 text-instance-status-panel-description sm:text-base sm:leading-7">
            {metadata.description}
          </p>
        </div>
      </div>
    </section>
  );
}

function getArtwork(status: PanelStatus) {
  switch (status) {
    case "initializing":
      return { kind: "rocket" as const };
    case "error":
      return { kind: "icon" as const, Icon: CircleAlert };
    case "offline":
      return { kind: "icon" as const, Icon: Unplug };
  }
}
