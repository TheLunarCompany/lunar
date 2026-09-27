import { Loader2, Server } from "lucide-react";

type ProvisioningScreenProps = {
  message?: string | null;
};

export function ProvisioningScreen(_props: ProvisioningScreenProps) {
  return (
    <section
      aria-label="Awaiting approval"
      className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-instance-status-panel-background p-6 text-center sm:p-8"
      data-instance-status="approval-pending"
      data-testid="approval-pending-screen"
    >
      <div className="flex w-full max-w-2xl flex-col items-center gap-6 rounded-3xl border border-instance-status-panel-border bg-instance-status-panel-surface px-6 py-12 shadow-[0_12px_32px_rgb(30_27_75_/_0.06)] sm:px-10 sm:py-16">
        <div
          aria-hidden="true"
          className="grid size-24 shrink-0 place-items-center rounded-full bg-instance-status-initializing-artwork text-instance-status-initializing sm:size-[104px]"
        >
          <Server className="size-10 stroke-[1.8]" />
        </div>
        <span
          className="rounded-full bg-instance-status-initializing-artwork px-3 py-1 text-[11px] font-bold leading-none tracking-[0.12em] text-instance-status-initializing"
          data-testid="approval-pending-badge"
        >
          AWAITING APPROVAL
        </span>
        <div className="flex max-w-prose flex-col gap-3">
          <h1 className="m-0 text-xl font-semibold leading-tight text-instance-status-panel-heading sm:text-2xl">
            Your MCPX request is awaiting approval
          </h1>
          <p className="m-0 text-sm leading-6 text-instance-status-panel-description sm:text-base sm:leading-7">
            An administrator needs to approve your request before we can create
            your workspace. We’ll connect you automatically once it’s ready.
          </p>
        </div>
        <div
          aria-live="polite"
          className="flex items-center justify-center gap-3 text-instance-status-panel-description"
          role="status"
        >
          <Loader2 className="size-5 animate-spin" />
          <span className="text-sm font-medium">Checking for approval</span>
        </div>
      </div>
    </section>
  );
}
