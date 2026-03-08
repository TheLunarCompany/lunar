const ICONIFY_BASE = "https://api.iconify.design";

const AGENT_ICONIFY_IDS: Record<string, string> = {
  claude: "logos:claude-icon",
  chatgpt: "arcticons:openai-chatgpt",
  "openai-mcp": "arcticons:openai-chatgpt",
  copilot: "logos:github-copilot",
  cursor: "simple-icons:cursor",
  vscode: "skill-icons:vscode-light",
  "visual studio code": "skill-icons:vscode-light",
  n8n: "simple-icons:n8n",
  windsurf: "carbon:code",
  default: "hugeicons:mcp-server",
  inspector: "hugeicons:mcp-server",
};

const DEFAULT_ICONIFY_ID = "hugeicons:mcp-server";

function getIconifyUrl(iconId: string): string {
  const [prefix, icon] = iconId.split(":");
  if (!prefix || !icon) return `${ICONIFY_BASE}/hugeicons/mcp-server.svg`;
  return `${ICONIFY_BASE}/${prefix}/${icon}.svg`;
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
