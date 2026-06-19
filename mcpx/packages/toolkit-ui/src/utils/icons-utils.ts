import {
  MCP_ICON_COLORS,
  AGENT_ICON_REGISTRY,
  SERVER_ICON_REGISTRY,
} from "./icons-constants";

/**
 * kind: "base"
 *   Iconify `logos` set. e.g. key "slack" → logos:slack
 *   withIcon: 'true' means that a `logos:<key>-icon` icon also exists and both UIs prefer this when available.
 *
 * kind: "custom"
 *   The icon lives in a different Iconify set or its ID contains chars that don't
 *   match the registry key.
 *   color is optional if we want to better adjust the icon.
 *
 * kind: "local"
 *   No Iconify icon exists for this server.
 *   mcpx-ui skips the network check and return /icons/<key>.png directly.
 *   admin-ui fall back to the MCP default icon.
 */
export type ServerIconEntry =
  | { kind: "base"; withIcon?: true }
  | { kind: "custom"; iconifyId: string; color?: string }
  | { kind: "local" };

export type AgentIconEntry =
  | { kind: "custom"; iconifyId: string; color?: string }
  | { kind: "local" };

export const ICONIFY_BASE = "https://api.iconify.design";

export const MCP_ICON_URL = (name: string): string => {
  return buildIconifyUrl("hugeicons:mcp-server", getMcpColorByName(name));
};

export function buildIconifyUrl(iconifyId: string, color?: string): string {
  const [prefix, icon] = iconifyId.split(":");
  if (!prefix || !icon) return "";
  const url = `${ICONIFY_BASE}/${prefix}/${icon}.svg`;
  return color ? `${url}?color=${encodeURIComponent(color)}` : url;
}

export function matchRegistryKey(
  name: string,
  registryKeys: string[],
): string | null {
  const lowerName = name.toLowerCase().trim();

  // exact match
  if (registryKeys.includes(lowerName)) return lowerName;

  // normalized exact: strip separators from input, handles, "claude code" → "claudecode"
  const stripped = lowerName.replace(/[-_.\s/]+/g, "");
  if (registryKeys.includes(stripped)) return stripped;

  // token scan: each word in the name checked against keys; longest match wins
  const tokens: string[] = lowerName.match(/[^-_.\s/]+/g) ?? [];
  const tokenMatches = registryKeys.filter((k) => tokens.includes(k));
  if (tokenMatches.length > 0) {
    return tokenMatches.reduce((a, b) => (a.length >= b.length ? a : b));
  }

  // substring: last resort for no-separator concatenations like "notionmcp"
  const substringMatches = registryKeys.filter((k) =>
    lowerName.includes(k.toLowerCase()),
  );
  if (substringMatches.length === 0) return null;
  return substringMatches.reduce((a, b) => (a.length >= b.length ? a : b));
}

/// mcpx-ui lookup
export function lookupRegistryKey(
  name: string,
): { key: string; entry: ServerIconEntry } | null {
  const key = matchRegistryKey(name, Object.keys(SERVER_ICON_REGISTRY));
  if (key) {
    const entry = SERVER_ICON_REGISTRY[key];
    if (entry) return { key, entry };
  }
  return null;
}

export function extractPrefix(name: string): string {
  // get the pre- hyphen/underscore word, maybe it's the server name
  return name.toLowerCase().split(/[-_]/, 1)[0] ?? name.toLowerCase();
}

export function lookupServerIcon(
  name: string,
  displayName?: string,
): { key: string; entry: ServerIconEntry } | null {
  const iconKeys = Object.keys(SERVER_ICON_REGISTRY);
  const key =
    matchRegistryKey(name, iconKeys) ??
    (displayName ? matchRegistryKey(displayName, iconKeys) : null);
  if (key) {
    const entry = SERVER_ICON_REGISTRY[key];
    if (entry) return { key, entry };
  }
  return null;
}

export function getAgentIconEntry(
  name: string,
): { key: string; entry: AgentIconEntry } | null {
  const key = matchRegistryKey(name, Object.keys(AGENT_ICON_REGISTRY));
  if (!key) return null;
  const entry = AGENT_ICON_REGISTRY[key];
  if (!entry) return null;
  return { key, entry };
}

// Admin-ui helper: kind "local" falls back to MCP since admin-ui has no local icon files.
export function getAgentIconUrl(name: string): string {
  const result = getAgentIconEntry(name);
  if (!result) return MCP_ICON_URL(name);
  if (result.entry.kind === "local") return MCP_ICON_URL(name);
  return buildIconifyUrl(result.entry.iconifyId, result.entry.color);
}

export function getMcpColorByName(name: string): string {
  const index =
    name
      .split("")
      .reduce((acc, word, index) => acc + word.charCodeAt(0) + index, 0) %
    MCP_ICON_COLORS.length;

  return MCP_ICON_COLORS[index] ?? "#000"; // fallback to black for type safety.
}
