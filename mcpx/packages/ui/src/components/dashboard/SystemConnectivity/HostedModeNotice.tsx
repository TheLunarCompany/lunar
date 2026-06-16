import { Button } from "@/components/ui/button";
import { ExternalLink, Server } from "lucide-react";

export const HostedModeNotice = ({
  returnUrl,
}: {
  returnUrl: string | null;
}) => (
  <div
    className="flex w-full flex-col gap-4 rounded-lg border border-[var(--colors-primary-200)] bg-[var(--colors-primary-50)] px-4 py-4 text-[var(--colors-primary-900)] shadow-sm ring-1 ring-[var(--colors-primary-100)] sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-5"
    role="status"
  >
    <div className="flex min-w-0 items-center gap-4">
      <span className="relative inline-flex size-14 shrink-0 items-center justify-center rounded-full border border-[var(--colors-primary-200)] bg-white text-[var(--colors-primary-500)] shadow-sm">
        <Server className="size-7" />
        <span className="absolute bottom-2 right-1.5 size-2.5 rounded-full bg-[var(--colors-primary-500)] ring-2 ring-white" />
      </span>
      <span className="min-w-0">
        <span className="block text-base font-semibold leading-6">
          Hosted Mode
        </span>
        <span className="block text-sm font-medium leading-5 text-[var(--colors-primary-700)]">
          You're editing the MCP server setup.
        </span>
      </span>
    </div>
    {returnUrl && (
      <div className="flex flex-col gap-2 border-[var(--colors-primary-100)] sm:flex-row sm:items-center sm:border-l sm:pl-6">
        <Button asChild className="min-w-28" size="sm">
          <a href={returnUrl}>
            Finish in MCPX Admin
            <ExternalLink data-icon="inline-end" />
          </a>
        </Button>
      </div>
    )}
  </div>
);
