import { McpServer } from "@/types";

/**
 * TODO: This manual comparison is an antipattern. The real fix is:
 * 1. Remove local state (mcpServers, aiAgents) from Dashboard.tsx
 * 2. Use processedData from useMemo directly
 * 3. Remove custom memo comparator from ConnectivityDiagram.tsx
 * 4. Let React's default memoization handle it
 *
 * This utility exists to deduplicate the comparison logic until that refactor happens.
 */
export const serversEqual = (prev: McpServer[], next: McpServer[]): boolean => {
  if (prev.length !== next.length) return false;

  return prev.every((prevServer) => {
    const nextServer = next.find((s) => s.id === prevServer.id);
    return (
      nextServer &&
      nextServer.name === prevServer.name &&
      nextServer.status === prevServer.status &&
      nextServer.tools.length === prevServer.tools.length &&
      JSON.stringify(nextServer.env) === JSON.stringify(prevServer.env) &&
      JSON.stringify(nextServer.missingEnvVars) ===
        JSON.stringify(prevServer.missingEnvVars)
    );
  });
};
