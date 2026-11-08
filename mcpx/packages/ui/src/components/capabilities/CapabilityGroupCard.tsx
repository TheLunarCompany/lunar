import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { useDomainIcon } from "@/hooks/useDomainIcon";
import { cn } from "@/lib/utils";
import { MoreVertical } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import ChatsIcon from "./icons/chats.svg?react";
import HammerIcon from "./icons/hammer.svg?react";
import VinylRecordIcon from "./icons/vinyl-record.svg?react";

type CapabilityGroupCardRootProps = ComponentPropsWithoutRef<typeof Card>;

function CapabilityGroupCardRoot({
  className,
  children,
  ...props
}: CapabilityGroupCardRootProps) {
  return (
    <Card
      className={cn(
        "relative w-full max-w-[380px] gap-2 rounded-lg border border-mcpx-border-subtle bg-mcpx-surface p-3 text-mcpx-text shadow-none ring-0",
        className,
      )}
      {...props}
    >
      {children}
    </Card>
  );
}

function CapabilityGroupCardHeader({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof CardHeader>) {
  return (
    <CardHeader
      className={cn(
        "flex min-w-0 flex-row items-center gap-2 p-0 pr-8",
        className,
      )}
      {...props}
    >
      {children}
    </CardHeader>
  );
}

function CapabilityGroupCardIcon({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--mcpx-surface)]",
        className,
      )}
      {...props}
    >
      <div className="grid grid-cols-3 grid-rows-2 gap-0">
        <span className="col-start-2 row-start-1 size-1.5 rounded-[1px] bg-mcpx-data-purple" />
        <span className="col-start-1 row-start-2 size-1.5 rounded-[1px] bg-mcpx-data-purple" />
        <span className="col-start-3 row-start-2 size-1.5 rounded-[1px] bg-mcpx-data-purple" />
      </div>
    </div>
  );
}

function CapabilityGroupCardTitle({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof CardTitle>) {
  return (
    <CardTitle
      className={cn(
        "min-w-0 truncate text-[15px] font-medium leading-[1.34] tracking-[0] text-mcpx-text",
        className,
      )}
      {...props}
    >
      {children}
    </CardTitle>
  );
}

function CapabilityGroupCardMenu({
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenu>) {
  return <DropdownMenu {...props}>{children}</DropdownMenu>;
}

function CapabilityGroupCardMenuButton({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenuTrigger>) {
  return (
    <CardAction className="absolute right-1 top-1">
      <DropdownMenuTrigger
        type="button"
        aria-label="Open capability group menu"
        className={buttonVariants({
          variant: "ghost",
          size: "icon",
          className: cn(
            "size-8 rounded-md text-mcpx-text-secondary hover:bg-mcpx-selected-weak",
            className,
          ),
        })}
        {...props}
      >
        <MoreVertical />
      </DropdownMenuTrigger>
    </CardAction>
  );
}

function CapabilityGroupCardMenuContent({
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

function CapabilityGroupCardMenuItem({
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenuItem>) {
  return <DropdownMenuItem {...props}>{children}</DropdownMenuItem>;
}

function CapabilityGroupCardProviders({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof CardContent>) {
  return (
    <CardContent
      className={cn("flex flex-wrap items-center gap-1 p-0", className)}
      {...props}
    >
      {children}
    </CardContent>
  );
}

function CapabilityGroupCardProviderBadge({
  name,
  toolsNumber,
  isMissingOrInactive = false,
  className,
}: {
  name: string;
  toolsNumber?: number;
  isMissingOrInactive?: boolean;
  className?: string;
}) {
  const domainIconUrl = useDomainIcon(name);

  return (
    <Badge
      variant="outline"
      className={cn(
        "flex h-6 items-center gap-1 rounded-[4px] border px-1 py-0 text-[11px] font-normal leading-[15px]",
        isMissingOrInactive
          ? "border-mcpx-warning-strong bg-mcpx-warning-bg text-mcpx-warning-strong"
          : "border-[var(--mcpx-border-subtle)] bg-[var(--mcpx-surface)] text-[var(--mcpx-text-secondary)]",
        className,
      )}
    >
      {domainIconUrl && (
        <img src={domainIconUrl} alt="" aria-hidden="true" className="size-4" />
      )}
      <span className="capitalize">{name}</span>
      {toolsNumber != null ? (
        <Badge
          variant="outline"
          className="h-auto rounded-[16px] border border-[var(--mcpx-border-subtle)] bg-[var(--mcpx-surface-subtle)] px-[6px] py-0 text-xs font-normal leading-[18px] text-[var(--mcpx-text-secondary)]"
        >
          {toolsNumber}
        </Badge>
      ) : null}
    </Badge>
  );
}

function CapabilityGroupCardMoreProviders({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (count <= 0) return null;

  return (
    <span
      className={cn(
        "text-[11px] font-normal leading-[1.4] text-mcpx-text",
        className,
      )}
    >
      +{count}
    </span>
  );
}

function CapabilityGroupCardDivider({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof Separator>) {
  return (
    <Separator
      className={cn("bg-mcpx-border-subtle", className)}
      decorative
      {...props}
    />
  );
}

function CapabilityGroupCardMetrics({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof CardFooter>) {
  return (
    <CardFooter
      className={cn("flex items-start gap-3 p-0", className)}
      {...props}
    >
      {children}
    </CardFooter>
  );
}

function CapabilityGroupCardMetric({
  icon,
  value,
  label,
  className,
  ...props
}: ComponentPropsWithoutRef<"div"> & {
  icon: ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div
      aria-label={`${label}: ${value}`}
      className={cn(
        "flex items-center gap-1 text-[11px] font-semibold leading-none text-mcpx-text",
        className,
      )}
      title={label}
      {...props}
    >
      <span className="grid size-4 place-items-center text-mcpx-text-secondary [--fill-0:currentColor] [&_svg]:size-4">
        {icon}
      </span>
      <span>{value}</span>
    </div>
  );
}

type CapabilityGroupCardDefaultMetricProps = Omit<
  ComponentPropsWithoutRef<"div">,
  "children"
> & {
  value: number;
  label?: string;
};

function CapabilityGroupCardToolsMetric({
  value,
  label = "Tools",
  ...props
}: CapabilityGroupCardDefaultMetricProps) {
  return (
    <CapabilityGroupCardMetric
      icon={<HammerIcon />}
      value={value}
      label={label}
      {...props}
    />
  );
}

function CapabilityGroupCardPromptsMetric({
  value,
  label = "Prompts",
  ...props
}: CapabilityGroupCardDefaultMetricProps) {
  return (
    <CapabilityGroupCardMetric
      icon={<ChatsIcon />}
      value={value}
      label={label}
      {...props}
    />
  );
}

function CapabilityGroupCardResourcesMetric({
  value,
  label = "Resources",
  ...props
}: CapabilityGroupCardDefaultMetricProps) {
  return (
    <CapabilityGroupCardMetric
      icon={<VinylRecordIcon />}
      value={value}
      label={label}
      {...props}
    />
  );
}

export const CapabilityGroupCard = Object.assign(CapabilityGroupCardRoot, {
  Header: CapabilityGroupCardHeader,
  Icon: CapabilityGroupCardIcon,
  Title: CapabilityGroupCardTitle,
  Menu: CapabilityGroupCardMenu,
  MenuButton: CapabilityGroupCardMenuButton,
  MenuContent: CapabilityGroupCardMenuContent,
  MenuItem: CapabilityGroupCardMenuItem,
  Providers: CapabilityGroupCardProviders,
  ProviderBadge: CapabilityGroupCardProviderBadge,
  MoreProviders: CapabilityGroupCardMoreProviders,
  Divider: CapabilityGroupCardDivider,
  Metrics: CapabilityGroupCardMetrics,
  Metric: CapabilityGroupCardMetric,
  ToolsMetric: CapabilityGroupCardToolsMetric,
  PromptsMetric: CapabilityGroupCardPromptsMetric,
  ResourcesMetric: CapabilityGroupCardResourcesMetric,
});
