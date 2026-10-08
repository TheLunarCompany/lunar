import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { Link } from "react-router-dom";
import { cva } from "class-variance-authority";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { getDefaultMcpxSidebarSections } from "./McpxSidebar.data";
import { useSkillsFeatureEnabled } from "@/data/skills";
import { InstanceStatusRow } from "@/components/instance-status/InstanceStatusRow";
import { McpxBrandLogo } from "@/components/branding/McpxBrandLogo";
import type { InstanceStatus } from "@/model/instance-status";
import { useFeatureFlag } from "@/contexts/feature-flags";

type SidebarIcon = ElementType<{ className?: string }>;

export type McpxSidebarItem = {
  id: string;
  label: string;
  icon: SidebarIcon;
  url?: string;
  disabled?: boolean;
};

export type McpxSidebarSection = {
  title: string;
  items: McpxSidebarItem[];
};

const menuItemVariants = cva(
  "h-10 rounded-[var(--border-radius-sm)] px-2 py-2 text-sm font-normal leading-6 tracking-[-0.02em] text-[var(--mcpx-sidebar-text)] shadow-none hover:bg-[var(--mcpx-sidebar-active)] hover:text-mcpx-tooltip-text disabled:font-normal disabled:text-mcpx-text-disabled disabled:[&&]:opacity-100",
  {
    variants: {
      isActive: {
        true: "data-[active=true]:bg-[var(--mcpx-sidebar-active)]! data-[active=true]:font-semibold data-[active=true]:text-mcpx-tooltip-text! data-[active=true]:hover:bg-[var(--mcpx-sidebar-active)]!",
        false: "",
      },
    },
  },
);

export type SidebarBrandProps = ComponentPropsWithoutRef<"div"> & {
  title?: string;
  subtitle?: string;
  isBoomi?: boolean;
};

export function SidebarBrand({
  title = "MCPX USER",
  subtitle,
  isBoomi = false,
  className,
  ...props
}: SidebarBrandProps) {
  return (
    <div
      className={cn(
        "flex h-[77px] items-center gap-3 border-b border-[var(--mcpx-sidebar-border)] px-4",
        className,
      )}
      {...props}
    >
      <McpxBrandLogo placement="sidebar" isBoomi={isBoomi} />
      <div className="flex flex-col text-mcpx-tooltip-text">
        <p className="text-base font-semibold leading-[1.4] tracking-[0]">
          {title}
        </p>
        {subtitle && (
          <p className="text-xs leading-none tracking-[0] text-mcpx-tooltip-text/60">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

export type SidebarAvatarProps = ComponentPropsWithoutRef<"div"> & {
  name: string;
  src?: string;
};

export function SidebarAvatar({
  name,
  src,
  className,
  ...props
}: SidebarAvatarProps) {
  const fallback = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div
      aria-label={name}
      className={cn(
        "grid size-10 place-items-center overflow-hidden rounded-full bg-mcpx-tooltip-text/20 text-sm font-semibold text-mcpx-tooltip-text ring-1 ring-mcpx-tooltip-text/20",
        className,
      )}
      {...props}
    >
      {src ? (
        <img src={src} alt={name} className="size-full object-cover" />
      ) : (
        <span>{fallback || "U"}</span>
      )}
    </div>
  );
}

export type McpxSidebarProps = ComponentPropsWithoutRef<typeof Sidebar> & {
  activeItemId?: string;
  sections?: McpxSidebarSection[];
  instanceStatus?: InstanceStatus;
  children?: ReactNode;
};

export function McpxSidebar({
  activeItemId,
  sections,
  instanceStatus,
  children,
  className,
  ...props
}: McpxSidebarProps) {
  const { data: skillsFeatureEnabled } = useSkillsFeatureEnabled();
  const capabilitiesEnabled = useFeatureFlag("VITE_ENABLE_CAPABILITIES_UI");
  const mcpServersShown = useFeatureFlag("VITE_SHOW_MCP_SERVERS");
  const isBoomi = useFeatureFlag("VITE_IS_BOOMI");
  const sidebarRestructureEnabled = useFeatureFlag(
    "VITE_UI_SIDEBAR_RESTRUCTURE",
  );
  const resolvedSections =
    sections ??
    getDefaultMcpxSidebarSections({
      skillsFeatureEnabled: skillsFeatureEnabled ?? false,
      capabilitiesEnabled,
      mcpServersShown,
      sidebarRestructureEnabled,
    });
  return (
    <Sidebar className={className} {...props}>
      <div
        data-slot="sidebar-inner-gradient"
        className="flex size-full flex-col rounded-lg bg-[var(--mcpx-sidebar)] text-mcpx-tooltip-text [--sidebar-accent:var(--mcpx-sidebar-active)] [--sidebar-accent-foreground:var(--mcpx-tooltip-text)] [--sidebar-ring:var(--mcpx-focus)]"
      >
        <SidebarHeader className="p-0">
          <SidebarBrand isBoomi={isBoomi} />
        </SidebarHeader>
        <SidebarContent className="gap-4 px-2 pt-5">
          {resolvedSections.map((section) => (
            <SidebarGroup key={section.title} className="px-0 py-0">
              <SidebarGroupLabel className="h-auto rounded-none px-2 py-0 text-xs font-normal leading-4 tracking-[-0.01em] text-[var(--mcpx-sidebar-text-muted)]">
                {section.title}
              </SidebarGroupLabel>
              <SidebarMenu className="mt-2 gap-1">
                {section.items.map((item) => (
                  <McpxSidebarMenuItem
                    key={item.id}
                    item={item}
                    isActive={item.id === activeItemId}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter className="border-t border-[var(--mcpx-sidebar-border)] p-3">
          {instanceStatus ? (
            <InstanceStatusRow status={instanceStatus} />
          ) : null}
          {children}
        </SidebarFooter>
      </div>
    </Sidebar>
  );
}

function McpxSidebarMenuItem({
  item,
  isActive,
}: {
  item: McpxSidebarItem;
  isActive: boolean;
}) {
  const Icon = item.icon;

  const buttonClassName = menuItemVariants({ isActive });

  if (item.url && !item.disabled) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={isActive}
          tooltip={item.label}
          className={buttonClassName}
        >
          <Link to={item.url}>
            <Icon />
            <span>{item.label}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        disabled={item.disabled}
        isActive={isActive}
        tooltip={item.label}
        className={buttonClassName}
      >
        <Icon />
        <span>{item.label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
