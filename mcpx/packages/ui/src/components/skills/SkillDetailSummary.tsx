import { LetterAvatar } from "@/components/LetterAvatar";
import { cn } from "@/lib/utils";
import { Clock3 } from "lucide-react";
import { createContext, useContext } from "react";

const skillUpdatedAtFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

type SkillIdentityContextValue = {
  name: string;
  description: string;
  maintainerName: string;
  updatedAt: Date;
};

const SkillIdentityContext = createContext<SkillIdentityContextValue | null>(
  null,
);

type SkillIdentityRootProps = React.ComponentProps<"section"> &
  SkillIdentityContextValue;

export function SkillIdentityRoot({
  name,
  description,
  maintainerName,
  updatedAt,
  className,
  children,
  ...props
}: SkillIdentityRootProps) {
  return (
    <SkillIdentityContext.Provider
      value={{ name, description, maintainerName, updatedAt }}
    >
      <section className={cn("pb-2", className)} {...props}>
        {children}
      </section>
    </SkillIdentityContext.Provider>
  );
}

export function SkillIdentityHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-w-0 items-center gap-3", className)}
      {...props}
    />
  );
}

export function SkillIdentityAvatar({
  className,
  ...props
}: Omit<React.ComponentProps<typeof LetterAvatar>, "name">) {
  const { name } = useSkillIdentity();

  return (
    <LetterAvatar
      name={name}
      className={cn("size-9 rounded-lg text-base", className)}
      {...props}
    />
  );
}

type SkillIdentityTitleProps = React.ComponentProps<"h1"> & {
  as?: "h1" | "h2";
};

export function SkillIdentityTitle({
  as: Component = "h1",
  className,
  ...props
}: SkillIdentityTitleProps) {
  const { name } = useSkillIdentity();

  return (
    <Component
      className={cn(
        "min-w-0 truncate text-base font-semibold leading-6 text-[var(--text-colours-color-text-primary)]",
        className,
      )}
      {...props}
    >
      {name}
    </Component>
  );
}

export function SkillIdentityActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("ml-auto shrink-0", className)} {...props} />;
}

export function SkillIdentityDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  const { description } = useSkillIdentity();

  return (
    <p
      className={cn(
        "mt-2 max-w-3xl text-sm leading-6 text-[var(--text-colours-color-text-secondary)]",
        className,
      )}
      {...props}
    >
      {description}
    </p>
  );
}

export function SkillIdentityMeta({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mt-4 flex flex-wrap items-center gap-4 text-xs text-[var(--text-colours-color-text-secondary)]",
        className,
      )}
      {...props}
    />
  );
}

export function SkillIdentityMaintainer() {
  const { maintainerName } = useSkillIdentity();

  return (
    <span className="inline-flex items-center gap-2">
      <span className="grid size-5 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
        {getInitial(maintainerName)}
      </span>
      <span>by</span>
      <strong className="font-semibold text-[var(--text-colours-color-text-primary)]">
        {maintainerName}
      </strong>
    </span>
  );
}

export function SkillIdentityUpdatedAt() {
  const { updatedAt } = useSkillIdentity();

  return (
    <span className="inline-flex items-center gap-1.5">
      <Clock3 className="size-3.5" />
      <span>Updated</span>
      <span className="font-semibold text-[var(--text-colours-color-text-primary)]">
        {skillUpdatedAtFormatter.format(updatedAt)}
      </span>
    </span>
  );
}

function useSkillIdentity() {
  const context = useContext(SkillIdentityContext);

  if (!context) {
    throw new Error("SkillIdentity components must be rendered inside Root.");
  }

  return context;
}

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}
