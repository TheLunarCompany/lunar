import type {
  CSSProperties,
  ComponentPropsWithoutRef,
  ElementType,
  ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { cva } from "class-variance-authority";
import McpxLogo from "@/components/dashboard/SystemConnectivity/nodes/Mcpx_Icon.svg?react";
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
import { defaultMcpxSidebarSections } from "./McpxSidebar.data";

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
  "h-10 rounded-lg px-3 py-2 text-sm font-medium leading-5 tracking-[0] shadow-none text-white/85 disabled:font-normal disabled:[&&]:opacity-30",
  {
    variants: {
      isActive: {
        true: "data-[active=true]:bg-black/35 data-[active=true]:hover:bg-black/35",
        false: "",
      },
    },
  },
);

export type SidebarBrandProps = ComponentPropsWithoutRef<"div"> & {
  title?: string;
  subtitle?: string;
};

export function SidebarBrand({
  title = "MCPX USER",
  subtitle = "by lunar.dev",
  className,
  ...props
}: SidebarBrandProps) {
  return (
    <div
      className={cn("flex items-center gap-2.5 px-4 py-5", className)}
      {...props}
    >
      <div className="relative grid size-8 place-items-center rounded-lg bg-[#5147e4] text-white shadow-[0_1px_1px_-0.5px_rgba(10,13,18,0.13),inset_0_-4.5px_8.5px_#808cff]">
        <McpxLogo className="size-5" />
      </div>
      <div className="flex flex-col text-white">
        <p className="text-sm font-semibold leading-[1.4] tracking-[0]">
          {title}
        </p>
        <p className="text-xs leading-none tracking-[0] text-white/40">
          {subtitle}
        </p>
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
        "grid size-10 place-items-center overflow-hidden rounded-full bg-white/20 text-sm font-semibold text-white ring-1 ring-white/15",
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
  children?: ReactNode;
};

export function McpxSidebar({
  activeItemId,
  sections = defaultMcpxSidebarSections,
  children,
  className,
  ...props
}: McpxSidebarProps) {
  return (
    <Sidebar className={className} {...props}>
      <div
        data-slot="sidebar-inner-gradient"
        className="flex size-full flex-col rounded-[12px] bg-[radial-gradient(circle_at_0%_0%,#3221c9_0%,#5c2595_30%,#872960_60%,#542071_80%,#201681_100%)] text-white"
        style={
          {
            "--sidebar-accent": "oklch(1 0 0 / 0.1)",
            "--sidebar-accent-foreground": "oklch(1 0 0)",
            "--sidebar-ring": "oklch(1 0 0 / 0.3)",
          } as CSSProperties
        }
      >
        <SidebarHeader className="p-0">
          <SidebarBrand />
        </SidebarHeader>
        <SidebarContent className="gap-5 pt-2">
          {sections.map((section) => (
            <SidebarGroup key={section.title} className="px-4 py-0">
              <SidebarGroupLabel className="h-auto rounded-lg p-2 text-[13px] font-semibold uppercase leading-none tracking-[0] text-white/65">
                {section.title}
              </SidebarGroupLabel>
              <SidebarMenu className="gap-1">
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
        <SidebarFooter className="px-4 pb-4">{children}</SidebarFooter>
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
