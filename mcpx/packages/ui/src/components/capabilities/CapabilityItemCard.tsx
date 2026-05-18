import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { MoreVertical } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

const titleBadgeVariants = cva(
  "flex h-7 min-w-0 max-w-full items-center gap-2 rounded px-1.5 py-1 text-sm font-medium leading-[1.34] tracking-[0] text-[var(--text-colours-color-text-primary)] [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        interactive: "bg-[var(--colors-primary-100)]",
        success: "bg-[var(--colors-success-100)]",
      },
    },
    defaultVariants: {
      variant: "interactive",
    },
  },
);

type CapabilityItemCardRootProps = ComponentPropsWithoutRef<typeof Card>;

function CapabilityItemCardRoot({
  className,
  children,
  ...props
}: CapabilityItemCardRootProps) {
  return (
    <Card
      className={cn(
        "relative flex max-w-full flex-col gap-4 rounded-lg border border-[var(--structure-color-border-primary)] bg-[var(--colors-white)] p-4 py-4 text-[var(--text-colours-color-text-primary)] shadow-none ring-0",
        className,
      )}
      {...props}
    >
      {children}
    </Card>
  );
}

function CapabilityItemCardHeader({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn("flex min-w-0 items-center gap-2", className)}
      {...props}
    >
      {children}
    </div>
  );
}

function CapabilityItemCardTitleBadge({
  className,
  children,
  icon,
  variant,
  ...props
}: ComponentPropsWithoutRef<"div"> &
  VariantProps<typeof titleBadgeVariants> & {
    icon?: ReactNode;
  }) {
  return (
    <div className={cn(titleBadgeVariants({ variant }), className)} {...props}>
      {icon}
      <span className="min-w-0 truncate">{children}</span>
    </div>
  );
}

function CapabilityItemCardStatusBadge({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof Badge>) {
  return (
    <Badge
      variant="outline"
      size="sm"
      className={cn(
        "h-[15px] rounded border-[var(--text-colours-color-text-secondary)] px-1 py-0 text-[10px] font-medium leading-none text-[var(--text-colours-color-text-secondary)]",
        className,
      )}
      {...props}
    >
      {children}
    </Badge>
  );
}

function CapabilityItemCardDescription({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"p">) {
  return (
    <p
      className={cn(
        "line-clamp-2 text-[13px] font-normal leading-[1.34] tracking-[0] text-[var(--text-colours-color-text-secondary)]",
        className,
      )}
      {...props}
    >
      {children}
    </p>
  );
}

function CapabilityItemCardDivider({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof Separator>) {
  return (
    <Separator
      className={cn("bg-[var(--structure-color-border-primary)]", className)}
      decorative
      {...props}
    />
  );
}

function CapabilityItemCardMetrics({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div className={cn("flex items-center gap-2", className)} {...props}>
      {children}
    </div>
  );
}

function CapabilityItemCardMetric({
  className,
  icon,
  value,
  label,
  ...props
}: Omit<ComponentPropsWithoutRef<"div">, "children"> & {
  icon: ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div
      aria-label={`${label}: ${value}`}
      title={label}
      className={cn(
        "flex items-center gap-1 text-[11px] font-semibold leading-none text-[var(--text-colours-color-text-primary)]",
        className,
      )}
      {...props}
    >
      <span className="grid size-4 place-items-center text-[var(--text-colours-color-text-secondary)] [&_svg]:size-4">
        {icon}
      </span>
      <span>{value}</span>
    </div>
  );
}

function CapabilityItemCardMenu({
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenu>) {
  return <DropdownMenu {...props}>{children}</DropdownMenu>;
}

function CapabilityItemCardMenuButton({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenuTrigger>) {
  return (
    <DropdownMenuTrigger
      type="button"
      aria-label="Open capability item menu"
      className={buttonVariants({
        variant: "ghost",
        size: "icon-sm",
        className: cn(
          "absolute right-1 top-1 text-[var(--text-colours-color-text-secondary)] hover:bg-[var(--structure-color-bg-container-overlay)]",
          className,
        ),
      })}
      {...props}
    >
      <MoreVertical />
    </DropdownMenuTrigger>
  );
}

function CapabilityItemCardMenuContent({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenuContent>) {
  return (
    <DropdownMenuContent
      align="end"
      className={cn("w-40", className)}
      {...props}
    >
      <DropdownMenuGroup>{children}</DropdownMenuGroup>
    </DropdownMenuContent>
  );
}

function CapabilityItemCardMenuItem({
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenuItem>) {
  return <DropdownMenuItem {...props}>{children}</DropdownMenuItem>;
}

export const CapabilityItemCard = Object.assign(CapabilityItemCardRoot, {
  Header: CapabilityItemCardHeader,
  TitleBadge: CapabilityItemCardTitleBadge,
  StatusBadge: CapabilityItemCardStatusBadge,
  Description: CapabilityItemCardDescription,
  Divider: CapabilityItemCardDivider,
  Metrics: CapabilityItemCardMetrics,
  Metric: CapabilityItemCardMetric,
  Menu: CapabilityItemCardMenu,
  MenuButton: CapabilityItemCardMenuButton,
  MenuContent: CapabilityItemCardMenuContent,
  MenuItem: CapabilityItemCardMenuItem,
});
