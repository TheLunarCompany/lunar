import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SkillSidebarCardRowVariant = "default" | "active" | "muted";

export function SkillSidebarCardRoot({
  className,
  ...props
}: React.ComponentProps<"aside">) {
  return (
    <aside
      className={cn(
        "rounded-lg border border-[var(--structure-color-border-primary)] bg-[var(--structure-color-bg-container)] p-4",
        className,
      )}
      {...props}
    />
  );
}

export function SkillSidebarCardHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center justify-between gap-3", className)}
      {...props}
    />
  );
}

export function SkillSidebarCardTitle({
  className,
  ...props
}: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn(
        "text-xs font-semibold uppercase tracking-normal text-[var(--colors-gray-600)]",
        className,
      )}
      {...props}
    />
  );
}

export function SkillSidebarCardCount({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Badge variant="purple" size="sm">
      {children}
    </Badge>
  );
}

export function SkillSidebarCardContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("mt-3 space-y-1", className)} {...props} />;
}

export function SkillSidebarCardRow({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & { variant?: SkillSidebarCardRowVariant }) {
  return (
    <div
      data-variant={variant}
      className={cn(
        "flex items-center gap-2 rounded-md border border-transparent p-1 text-sm text-[var(--text-colours-color-text-primary)]",
        variant === "active" &&
          "border-[var(--colors-purple-300)] bg-[var(--colors-purple-50)]",
        variant === "muted" &&
          "text-[var(--text-colours-color-text-secondary)] opacity-60",
        className,
      )}
      {...props}
    />
  );
}

export function SkillSidebarCardRowButton({
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    />
  );
}

export function SkillSidebarCardIcon({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center",
        className,
      )}
      {...props}
    />
  );
}

export function SkillSidebarCardActionButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="outline"
      className={cn(
        "mt-3 w-full rounded-lg border-[var(--colors-purple-300)] text-[var(--colors-purple-700)] hover:bg-[var(--colors-purple-50)]",
        className,
      )}
      {...props}
    />
  );
}
