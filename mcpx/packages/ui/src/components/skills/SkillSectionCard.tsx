import { cn } from "@/lib/utils";

type SkillSectionCardProps = React.ComponentProps<"section"> & {
  icon: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  contentClassName?: string;
  headerClassName?: string;
};

export function SkillSectionCard({
  icon,
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
  headerClassName,
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
      <div
        className={cn(
          "flex min-h-14 flex-col items-start justify-between gap-3 border-b border-[var(--colors-gray-200)] bg-[var(--colors-gray-100)] px-4 py-3 sm:flex-row sm:items-center",
          headerClassName,
        )}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="shrink-0 text-primary">{icon}</span>
          <h2 className="min-w-0 text-sm font-semibold text-[var(--text-colours-color-text-primary)]">
            {title}
          </h2>
          {description ? (
            <span className="min-w-0 truncate text-sm text-[var(--text-colours-color-text-secondary)]">
              {description}
            </span>
          ) : null}
        </div>
        {actions ? (
          <div className="flex w-full shrink-0 justify-start sm:w-auto sm:justify-end">
            {actions}
          </div>
        ) : null}
      </div>

      <div className={cn("bg-[var(--colors-gray-50)]", contentClassName)}>
        {children}
      </div>
    </section>
  );
}
