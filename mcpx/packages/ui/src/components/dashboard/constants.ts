import { getAgentIconUrl } from "@/lib/agent-icons";
import { MCP_ICON_COLORS } from "./SystemConnectivity/nodes/constants";
import { AgentType } from "./types";

export const DEFAULT_SERVER_ICON = MCP_ICON_COLORS[0];

export function getMcpColorByName(name: string) {
  const index =
    name
      .split("")
      .reduce((acc, word, index) => acc + word.charCodeAt(0) + index, 0) %
    MCP_ICON_COLORS.length;

  return MCP_ICON_COLORS[index];
}

/** Each agent type has an array of patterns; a match is when the name includes any of them. */
export const AGENT_TYPES = {
  CURSOR: ["cursor"],
  "CLAUDE-DESKTOP": ["claude", "claude desktop", "anthropic"],
  "CLAUDE-CODE": ["claude-code", "claude code"],
  DEFAULT: ["default"],
  WIND_SURF: ["windsurf"],
  INSPECTOR: ["inspector"],
  VSCODE: ["vs code", "vscode", "visual studio code"],
  COPILOT: ["copilot"],
  "openai-mcp": ["openai-mcp", "openai", "chatgpt"],
  N8N: ["n8n"],
} as const;

/** When multiple types match (e.g. "cursor-vscode"), first in this list wins. */
export const AGENT_TYPE_PREFERENCE_ORDER: AgentType[] = [
  "CURSOR",
  "VSCODE",
  "CLAUDE-CODE",
  "CLAUDE-DESKTOP",
  "COPILOT",
  "openai-mcp",
  "WIND_SURF",
  "N8N",
  "INSPECTOR",
  "DEFAULT",
];

/** Keys used for getAgentIconUrl (single source of truth in @/lib/agent-icons). */
const AGENT_ICON_KEYS: Record<AgentType, string> = {
  "CLAUDE-DESKTOP": "claudeDesktop",
  "CLAUDE-CODE": "claudeCode",
  CURSOR: "cursor",
  VSCODE: "vscode",
  COPILOT: "copilot",
  WIND_SURF: "windsurf",
  INSPECTOR: "inspector",
  "openai-mcp": "openai-mcp",
  N8N: "n8n",
  DEFAULT: "default",
};

export const agentsData: Record<AgentType, { icon: string; name: string }> = {
  "CLAUDE-DESKTOP": {
    icon: getAgentIconUrl(AGENT_ICON_KEYS["CLAUDE-DESKTOP"]),
    name: "Claude Desktop",
  },
  "CLAUDE-CODE": {
    icon: getAgentIconUrl(AGENT_ICON_KEYS["CLAUDE-CODE"]),
    name: "Claude Code",
  },

  CURSOR: {
    icon: getAgentIconUrl(AGENT_ICON_KEYS.CURSOR),
    name: "Cursor",
  },
  VSCODE: {
    icon: getAgentIconUrl(AGENT_ICON_KEYS.VSCODE),
    name: "VScode",
  },
  COPILOT: {
    icon: getAgentIconUrl(AGENT_ICON_KEYS.COPILOT),
    name: "Copilot",
  },
  WIND_SURF: {
    icon: getAgentIconUrl(AGENT_ICON_KEYS.WIND_SURF),
    name: "Windsurf",
  },
  INSPECTOR: {
    icon: getAgentIconUrl(AGENT_ICON_KEYS.INSPECTOR),
    name: "Inspector",
  },
  "openai-mcp": {
    icon: getAgentIconUrl(AGENT_ICON_KEYS["openai-mcp"]),
    name: "ChatGPT",
  },
  N8N: {
    icon: getAgentIconUrl(AGENT_ICON_KEYS.N8N),
    name: "N8N node",
  },
  DEFAULT: {
    icon: getAgentIconUrl(AGENT_ICON_KEYS.DEFAULT),
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
  "h-[calc(50vh-1.5rem-8px-2px-53px)]";
export const DASHBOARD_PANE_HEIGHT_COLLAPSED_DIAGRAM_TW_CLASS =
  "h-[calc(100vh-1.5rem-145px)]";
