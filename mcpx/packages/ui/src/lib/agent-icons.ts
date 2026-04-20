const ICONIFY_BASE = "https://api.iconify.design";
type AgentIconConfig = {
  icon: string;
  color?: string;
};

const AGENT_ICONIFY_IDS: Record<string, AgentIconConfig> = {
  claudedesktop: { icon: "logos:claude-icon" },
  claudecode: { icon: "cbi:claude-clawd", color: "#d97757" },
  chatgpt: { icon: "simple-icons:openai" },
  "openai-mcp": { icon: "simple-icons:openai" },
  copilot: { icon: "logos:github-copilot" },
  cursor: { icon: "simple-icons:cursor" },
  vscode: { icon: "logos:visual-studio-code" },
  "visual studio code": { icon: "logos:visual-studio-code" },
  n8n: { icon: "simple-icons:n8n", color: "#EA4B71" },
  windsurf: { icon: "simple-icons:windsurf", color: "#00BFA5" },
  default: { icon: "hugeicons:mcp-server", color: "#5147E4" },
  inspector: { icon: "hugeicons:mcp-server", color: "#5147E4" },
};

const DEFAULT_ICONIFY_ID = { icon: "hugeicons:mcp-server" };

function getIconifyUrl(iconConfig: AgentIconConfig): string {
  const iconId = iconConfig.icon;
  const color = iconConfig.color;
  const [prefix, icon] = iconId.split(":");
  if (!prefix || !icon) return `${ICONIFY_BASE}/hugeicons/mcp-server.svg`;
  const url = `${ICONIFY_BASE}/${prefix}/${icon}.svg`;
  return color ? `${url}?color=${encodeURIComponent(color)}` : url;
}

export function getAgentIconUrl(name: string | null | undefined): string {
  if (!name || typeof name !== "string") {
    return getIconifyUrl(DEFAULT_ICONIFY_ID);
  }
  const key = name.toLowerCase().trim();

  if (AGENT_ICONIFY_IDS[key]) {
    return getIconifyUrl(AGENT_ICONIFY_IDS[key]);
  }
  for (const [agentKey, iconId] of Object.entries(AGENT_ICONIFY_IDS)) {
    if (key.includes(agentKey) || agentKey.includes(key)) {
      return getIconifyUrl(iconId);
    }
  }
  return getIconifyUrl(DEFAULT_ICONIFY_ID);
}
