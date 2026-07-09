import { cn } from "@/lib/utils";

type SkillPageRootProps = React.ComponentProps<"div"> & {
  overflow?: "auto" | "hidden";
};

export function Root({
  children,
  className,
  overflow = "auto",
  ...props
}: SkillPageRootProps) {
  return (
    <div
      data-slot="skill-page-root"
      data-overflow={overflow}
      className={cn(
        "relative flex min-h-0 flex-1 flex-col bg-[var(--structure-color-bg-app)] p-6",
        overflow === "hidden" ? "overflow-hidden" : "overflow-auto",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

type SkillPageContainerProps = React.ComponentProps<"div"> & {
  size?: "full" | "wide" | "form";
};

export function Container({
  children,
  className,
  size = "full",
  ...props
}: SkillPageContainerProps) {
  return (
    <div
      data-slot="skill-page-container"
      data-size={size}
      className={cn(
        "mx-auto flex w-full flex-col",
        size === "full" && "container min-h-0 flex-1",
        size === "wide" && "max-w-4xl gap-6",
        size === "form" && "max-w-3xl gap-6",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function Header({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skill-page-header"
      className={cn(
        "flex shrink-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function HeaderText({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skill-page-header-text"
      className={cn("max-w-3xl", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function Title({
  children,
  className,
  ...props
}: React.ComponentProps<"h1">) {
  return (
    <h1
      data-slot="skill-page-title"
      className={cn(
        "text-[20px] font-semibold leading-7 text-[var(--text-colours-color-text-primary)]",
        className,
      )}
      {...props}
    >
      {children}
    </h1>
  );
}

export function Description({
  children,
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="skill-page-description"
      className={cn(
        "mt-2 max-w-2xl text-sm leading-6 text-[var(--text-colours-color-text-secondary)]",
        className,
      )}
      {...props}
    >
      {children}
    </p>
  );
}

export function Actions({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skill-page-actions"
      className={cn("flex shrink-0 items-center gap-2", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function Toolbar({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skill-page-toolbar"
      className={cn(
        "mb-4 flex shrink-0 flex-wrap items-center gap-2",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function Content({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div data-slot="skill-page-content" className={className} {...props}>
      {children}
    </div>
  );
}

export function Message({
  title,
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  title: string;
}) {
  return (
    <div
      data-slot="skill-page-message"
      className={cn(
        "grid min-h-40 place-items-center gap-4 rounded-lg border border-dashed border-[var(--structure-color-border-primary)] text-sm text-[var(--text-colours-color-text-secondary)]",
        className,
      )}
      {...props}
    >
      <span>{title}</span>
      {children}
    </div>
  );
}
