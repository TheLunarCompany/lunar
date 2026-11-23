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
        "rounded-lg border border-mcpx-border-subtle bg-mcpx-surface p-4",
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
        "text-xs font-semibold uppercase tracking-normal text-mcpx-text-secondary",
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
        "flex items-center gap-2 rounded-md border border-transparent p-1 text-sm text-mcpx-text",
        variant === "active" && "border-mcpx-selected bg-mcpx-selected-weak",
        variant === "muted" && "text-mcpx-text-secondary opacity-60",
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
        "mt-3 w-full rounded-lg border-mcpx-selected text-mcpx-selected hover:bg-mcpx-selected-weak",
        className,
      )}
      {...props}
    />
  );
}
