import {
  parseHostedMcpEditContext,
  type HostedMcpEditContext,
} from "@mcpx/toolkit-ui/src/utils/hosted-mcp-edit-url";

export type { HostedMcpEditContext };

export function getHostedMcpEditContextFromLocation(): HostedMcpEditContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  return parseHostedMcpEditContext(window.location.search);
}
