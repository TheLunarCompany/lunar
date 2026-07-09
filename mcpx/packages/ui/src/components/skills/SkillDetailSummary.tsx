import { cn } from "@/lib/utils";
import { Clock3 } from "lucide-react";

const skillUpdatedAtFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

type SkillDetailSummaryProps = React.ComponentProps<"section"> & {
  name: string;
  description: string;
  maintainerName: string;
  updatedAt: Date;
};

export function SkillDetailSummary({
  name,
  description,
  maintainerName,
  updatedAt,
  className,
  ...props
}: SkillDetailSummaryProps) {
  return (
    <section className={cn("pb-2", className)} {...props}>
      <h2 className="text-base font-semibold leading-6 text-[var(--text-colours-color-text-primary)]">
        {name}
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-colours-color-text-secondary)]">
        {description}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-[var(--text-colours-color-text-secondary)]">
        <span className="inline-flex items-center gap-2">
          <span className="grid size-5 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
            {getInitial(maintainerName)}
          </span>
          <span>Maintained by</span>
          <strong className="font-semibold text-[var(--text-colours-color-text-primary)]">
            {maintainerName}
          </strong>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="size-3.5" />
          <span>Updated</span>
          <span className="font-semibold text-[var(--text-colours-color-text-primary)]">
            {skillUpdatedAtFormatter.format(updatedAt)}
          </span>
        </span>
      </div>
    </section>
  );
}

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}
