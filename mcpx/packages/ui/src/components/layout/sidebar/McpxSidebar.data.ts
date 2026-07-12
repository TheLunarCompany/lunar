import {
  Gauge,
  Hammer,
  Library,
  FileText,
  Sparkles,
  ScrollText,
  Server,
  SlidersHorizontal,
  Zap,
} from "lucide-react";
import {
  isCapabilitiesEnabled,
  isSkillsPageEnabled,
  isUiSidebarRestructureEnabled,
} from "@/config/runtime-config";
import { routes } from "@/routes";
import type { McpxSidebarSection } from "./McpxSidebar";

export function getDefaultMcpxSidebarSections(): McpxSidebarSection[] {
  if (isUiSidebarRestructureEnabled()) {
    return getRestructuredMcpxSidebarSections();
  }

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

  if (isSkillsPageEnabled()) {
    workspaceItems.push({
      id: "skills",
      label: "Skills",
      icon: Sparkles,
      url: routes.skills,
    });
  }

  workspaceItems.push({
    id: "saved-setups",
    label: "Saved Setups",
    icon: SlidersHorizontal,
    url: routes.savedSetups,
  });

  workspaceItems.push({
    id: "audit-log",
    label: "Audit Log",
    icon: ScrollText,
    url: routes.auditLog,
  });

  return [
    {
      title: "Workspace",
      items: workspaceItems,
    },
  ];
}

function getRestructuredMcpxSidebarSections(): McpxSidebarSection[] {
  const workspaceItems: McpxSidebarSection["items"] = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: Gauge,
      url: routes.dashboard,
    },
    {
      id: "mcp-servers",
      label: "MCP Servers",
      icon: Server,
      url: routes.mcpServers,
    },
  ];

  if (isSkillsPageEnabled()) {
    workspaceItems.push({
      id: "skills",
      label: "Skills",
      icon: FileText,
      url: routes.skills,
    });
  }

  workspaceItems.push(
    {
      id: "saved-setups",
      label: "Saved Setups",
      icon: SlidersHorizontal,
      url: routes.savedSetups,
    },
    {
      id: "audit-log",
      label: "Audit Log",
      icon: ScrollText,
      url: routes.auditLog,
    },
  );

  return [
    {
      title: "Workspace",
      items: workspaceItems,
    },
    {
      title: "Catalogs",
      items: [
        {
          id: "mcp-registry",
          label: "MCP Registry",
          icon: Library,
          url: routes.catalog,
        },
      ],
    },
  ];
}
