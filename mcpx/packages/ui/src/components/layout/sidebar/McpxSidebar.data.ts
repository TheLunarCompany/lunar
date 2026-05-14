import { Gauge, Hammer, Library, SlidersHorizontal, Zap } from "lucide-react";
import { isCapabilitiesEnabled } from "@/config/runtime-config";
import { routes } from "@/routes";
import type { McpxSidebarSection } from "./McpxSidebar";

export function getDefaultMcpxSidebarSections(): McpxSidebarSection[] {
  const workspaceItems: McpxSidebarSection["items"] = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: Gauge,
      url: routes.dashboard,
    },
    { id: "catalog", label: "Catalog", icon: Library, url: routes.catalog },
    { id: "tools", label: "Tools", icon: Hammer, url: routes.tools },
  ];

  if (isCapabilitiesEnabled()) {
    workspaceItems.push({
      id: "capabilities",
      label: "Capabilities",
      icon: Zap,
      url: routes.capabilities,
    });
  }

  workspaceItems.push({
    id: "saved-setups",
    label: "Saved Setups",
    icon: SlidersHorizontal,
    url: routes.savedSetups,
  });

  return [
    {
      title: "Workspace",
      items: workspaceItems,
    },
  ];
}
