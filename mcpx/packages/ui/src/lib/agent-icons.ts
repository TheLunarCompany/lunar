import {
  getAgentIconEntry,
  buildIconifyUrl,
  MCP_ICON_URL,
} from "@mcpx/toolkit-ui/src/utils/icons-utils";

export function getAgentIcon(name: string): string {
  const result = getAgentIconEntry(name);
  if (!result) return MCP_ICON_URL(name);
  if (result.entry.kind === "local") return `/icons/${result.key}.svg`;
  return buildIconifyUrl(result.entry.iconifyId, result.entry.color);
}
