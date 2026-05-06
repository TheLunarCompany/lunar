import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  BookOpen,
  Gauge,
  Hammer,
  Library,
  SlidersHorizontal,
} from "lucide-react";
import { MemoryRouter } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import {
  McpxSidebar,
  SidebarAvatar,
  SidebarBrand,
  type McpxSidebarSection,
} from "./McpxSidebar";
import { defaultMcpxSidebarSections } from "./McpxSidebar.data";

const sidebarGradient =
  "bg-[radial-gradient(circle_at_0%_0%,#3221c9_0%,#5c2595_30%,#872960_60%,#542071_80%,#201681_100%)]";

const typographySections: McpxSidebarSection[] = [
  {
    title: "Workspace",
    items: [
      { id: "dashboard", label: "Dashboard", icon: Gauge, url: "/dashboard" },
      { id: "catalog", label: "Catalog", icon: Library, url: "/catalog" },
      {
        id: "debugging",
        label: "Debugging",
        icon: BookOpen,
        url: "/debugging",
      },
      {
        id: "saved-settings",
        label: "Saved Settings",
        icon: SlidersHorizontal,
        url: "/saved-settings",
      },
    ],
  },
];

const multiSectionNavigation: McpxSidebarSection[] = [
  ...defaultMcpxSidebarSections,
  {
    title: "Admin",
    items: [
      {
        id: "very-long-label",
        label: "Extremely Long Navigation Label That Truncates",
        icon: Library,
        url: "/long-label",
      },
      {
        id: "disabled",
        label: "Disabled Feature",
        icon: Hammer,
        disabled: true,
      },
    ],
  },
];

const meta = {
  title: "Layout/Sidebar",
  component: McpxSidebar,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    activeItemId: {
      control: "select",
      options: ["dashboard", "catalog", "tools", "saved-setups"],
    },
  },
} satisfies Meta<typeof McpxSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

const renderSidebarShell: Story["render"] = (args) => (
  <SidebarProvider>
    <div className="grid h-svh w-full grid-cols-[16rem_minmax(0,1fr)] gap-1.5 bg-[#fcfcfc] bg-[linear-gradient(135deg,#dad9f6_0%,rgb(255_207_236_/_0.5)_100%)] p-1.5">
      <McpxSidebar
        {...args}
        collapsible="none"
        className="min-h-0 overflow-hidden rounded-xl"
      >
        <SidebarAvatar name="MCPX User" />
      </McpxSidebar>
      <div className="flex min-h-0 min-w-0 items-center justify-center rounded-[12px] bg-white text-sm font-medium text-slate-400">
        App content
      </div>
    </div>
  </SidebarProvider>
);

export const Brand: Story = {
  render: () => (
    <div className={`w-64 rounded-[12px] ${sidebarGradient}`}>
      <SidebarBrand />
    </div>
  ),
};

export const AvatarImage: Story = {
  render: () => (
    <div className="rounded-[12px] bg-[#201681] p-4">
      <SidebarAvatar name="MCPX User" src="/favicon.svg" />
    </div>
  ),
};

export const AvatarFallback: Story = {
  render: () => (
    <div className="rounded-[12px] bg-[#201681] p-4">
      <SidebarAvatar name="MCPX User" />
    </div>
  ),
};

export const FullSidebar: Story = {
  parameters: {
    layout: "fullscreen",
  },
  args: {
    activeItemId: "dashboard",
    sections: defaultMcpxSidebarSections,
  },
  render: renderSidebarShell,
};

export const ActiveCatalog: Story = {
  parameters: {
    layout: "fullscreen",
  },
  args: {
    activeItemId: "catalog",
    sections: defaultMcpxSidebarSections,
  },
  render: renderSidebarShell,
};

export const MultiSection: Story = {
  parameters: {
    layout: "fullscreen",
  },
  args: {
    activeItemId: "very-long-label",
    sections: multiSectionNavigation,
  },
  render: renderSidebarShell,
};

export const TypographyDescenders: Story = {
  parameters: {
    layout: "fullscreen",
  },
  args: {
    activeItemId: "catalog",
    sections: typographySections,
  },
  render: renderSidebarShell,
};

export const EmptyNavigation: Story = {
  parameters: {
    layout: "fullscreen",
  },
  args: {
    sections: [],
  },
  render: renderSidebarShell,
};
