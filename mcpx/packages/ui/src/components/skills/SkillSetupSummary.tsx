import { cn } from "@/lib/utils";

type SetupCardProps = React.ComponentProps<"div">;

export function SkillSetupSummaryRoot({
  className,
  children,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      aria-label="Skill setup"
      className={cn("grid min-w-0 gap-3 md:grid-cols-3", className)}
      {...props}
    >
      {children}
    </section>
  );
}

export function SkillSetupSummaryCard({ className, ...props }: SetupCardProps) {
  return (
    <div
      className={cn(
        "flex min-h-16 min-w-0 items-center gap-2 rounded-lg border border-[var(--structure-color-border-primary)] bg-[var(--colors-white)] px-4 py-2",
        className,
      )}
      {...props}
    />
  );
}

export function SkillSetupSummaryIcon({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full border-0 bg-[var(--component-colours-color-fg-interactive)] text-[var(--colors-white)]",
        className,
      )}
      {...props}
    />
  );
}

export function SkillSetupSummaryContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("min-w-0 flex-1", className)} {...props} />;
}

export function SkillSetupSummaryTitle({
  className,
  ...props
}: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn(
        "truncate text-[13px] font-semibold leading-[18px] text-[var(--text-colours-color-text-primary)]",
        className,
      )}
      {...props}
    />
  );
}

export function SkillSetupSummaryDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "truncate text-xs leading-[18px] text-[var(--text-colours-color-text-secondary)]",
        className,
      )}
      {...props}
    />
  );
}

export function SkillSetupSummaryAction({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("shrink-0", className)} {...props} />;
}

// This compound API intentionally exports several component slots from one module.
// eslint-disable-next-line react-refresh/only-export-components
export const SkillSetupSummary = {
  Root: SkillSetupSummaryRoot,
  Card: SkillSetupSummaryCard,
  Icon: SkillSetupSummaryIcon,
  Content: SkillSetupSummaryContent,
  Title: SkillSetupSummaryTitle,
  Description: SkillSetupSummaryDescription,
  Action: SkillSetupSummaryAction,
};
