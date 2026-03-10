const ICONIFY_BASE = "https://api.iconify.design";
type AgentIconConfig = {
  icon: string;
  color?: string;
};

const AGENT_ICONIFY_IDS: Record<string, AgentIconConfig> = {
  claudedesktop: { icon: "logos:claude-icon" },
  claudecode: { icon: "cbi:claude-clawd", color: "#d97757" }, // Add your desired color here
  chatgpt: { icon: "arcticons:openai-chatgpt" },
  "openai-mcp": { icon: "arcticons:openai-chatgpt" },
  copilot: { icon: "logos:github-copilot" },
  cursor: { icon: "simple-icons:cursor" },
  vscode: { icon: "skill-icons:vscode-light" },
  "visual studio code": { icon: "skill-icons:vscode-light" },
  n8n: { icon: "simple-icons:n8n" },
  windsurf: { icon: "carbon:code" },
  default: { icon: "hugeicons:mcp-server" },
  inspector: { icon: "hugeicons:mcp-server" },
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
