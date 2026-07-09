import { cn } from "@/lib/utils";

type SkillSectionCardProps = React.ComponentProps<"section"> & {
  icon: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  contentClassName?: string;
};

export function SkillSectionCard({
  icon,
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
  ...props
}: SkillSectionCardProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-[var(--colors-gray-200)] bg-[var(--colors-gray-50)] shadow-sm",
        className,
      )}
      {...props}
    >
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-[var(--colors-gray-200)] bg-[var(--colors-gray-100)] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-primary">{icon}</span>
          <h2 className="shrink-0 text-sm font-semibold text-[var(--text-colours-color-text-primary)]">
            {title}
          </h2>
          {description ? (
            <span className="truncate text-sm text-[var(--text-colours-color-text-secondary)]">
              {description}
            </span>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>

      <div className={cn("bg-[var(--colors-gray-50)]", contentClassName)}>
        {children}
      </div>
    </section>
  );
}
