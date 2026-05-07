import { Gauge, Hammer, Library, SlidersHorizontal } from "lucide-react";
import type { McpxSidebarSection } from "./McpxSidebar";

export const defaultMcpxSidebarSections: McpxSidebarSection[] = [
  {
    title: "Workspace",
    items: [
      { id: "dashboard", label: "Dashboard", icon: Gauge, url: "/dashboard" },
      { id: "catalog", label: "Catalog", icon: Library, url: "/catalog" },
      { id: "tools", label: "Tools", icon: Hammer, url: "/tools" },
      {
        id: "saved-setups",
        label: "Saved Setups",
        icon: SlidersHorizontal,
        url: "/saved-setups",
      },
    ],
  },
];
