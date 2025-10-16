import { MCP_ICON_COLORS } from "./SystemConnectivity/nodes";
import { AgentType } from "./types";

export const DEFAULT_SERVER_ICON = MCP_ICON_COLORS[0];

export const AGENT_TYPES = {
  CURSOR: 'cursor',
  CLAUDE: 'claude',
  DEFAULT: 'default',
  WIND_SURF: 'windsurf',
  // Add more agent types here as needed
} as const;

export const agentsData: Record<AgentType, { icon: string; name: string }> = {
  CLAUDE: {
    icon: "/img/claude_icon_mcp.png",
    name: "Claude",
  },
  CURSOR: {
    icon: "/img/cursor_icon_mcp.jpg",
    name: "Cursor",
  },
  WIND_SURF: {
    icon: "/img/windsurf_icon_mcp.png",
    name: "Windsurf",
  },
  DEFAULT: {
    icon: "/img/default_icon_mcp.png",
    name: "Default",
  },
};

// The dashboard consists of 2 panes, which share a container and have a gap/margin.
// To get each pane's height, start from 50vh and subtract:
//  - half of top/bottom padding (1.5rem)
//  - half of margin/gap (8px)
//  - half of border width (2px)
//  - half of header (53px)
export const DASHBOARD_PANE_HEIGHT_TW_CLASS =
  "h-[calc(50vh_-_1.5rem_-_8px_-_2px_-_53px)]";
export const DASHBOARD_PANE_HEIGHT_COLLAPSED_DIAGRAM_TW_CLASS =
  "h-[calc(100vh_-_1.5rem_-_145px)]";
