import { useSocketStore, useMetricsStore } from "@/store";
import { useToolsMetric } from "@/components/dashboard/ToolsMetric";
import { Agent, McpServer } from "@/types";
import { isActive } from "@/utils";
import { transformConfigurationData } from "@/utils/transform-system-state";
import { MetricSnapshot } from "@/store/metrics";
import { useCallback, useEffect, useMemo, useRef } from "react";

export type { MetricSnapshot };

export const SAMPLE_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
const EMPTY_SERVERS: McpServer[] = [];
const EMPTY_AGENTS: Agent[] = [];

export function deriveMetrics(
  agents: Agent[],
  servers: McpServer[],
  toolsValue: string,
  systemUsage?: { callCount: number; lastCalledAt?: Date },
): Omit<MetricSnapshot, "timestamp"> {
  const connectedServers = servers.filter(
    (s) =>
      s.status === "connected_running" || s.status === "connected_stopped",
  ).length;

  const activeAgents = agents.filter(
    (a) => a.status === "connected" && isActive(a.lastActivity),
  ).length;

  // toolsValue is "available/connected" — we use the available (left) number
  const toolsCount = parseInt(toolsValue.split("/")[0], 10) || 0;

  return {
    tools: toolsCount,
    servers: connectedServers,
    agents: activeAgents,
    totalRequests: systemUsage?.callCount ?? 0,
  };
}

export function useMetricsCache() {
  const snapshots = useMetricsStore((s) => s.snapshots);
  const clearCache = useMetricsStore((s) => s.clearCache);

  return { snapshots, clearCache };
}

export function useMetricsSampler() {
  const systemState = useSocketStore((s) => s.systemState);
  const addSnapshot = useMetricsStore((s) => s.addSnapshot);

  // Transform the raw system state into our internal types
  const transformed = useMemo(
    () => (systemState ? transformConfigurationData(systemState) : null),
    [systemState],
  );

  const servers = transformed?.servers ?? EMPTY_SERVERS;
  const agents = transformed?.agents ?? EMPTY_AGENTS;
  const systemUsage = transformed?.systemUsage;

  const toolsValue = useToolsMetric({ agents, servers });

  // Keep a ref to the latest derived values so the interval callback doesn't go stale
  const latestRef = useRef({ agents, servers, toolsValue, systemUsage });
  useEffect(() => {
    latestRef.current = { agents, servers, toolsValue, systemUsage };
  }, [agents, servers, toolsValue, systemUsage]);

  const takeSample = useCallback(() => {
    const {
      agents: a,
      servers: s,
      toolsValue: tv,
      systemUsage: su,
    } = latestRef.current;
    const metrics = deriveMetrics(a, s, tv, su);
    addSnapshot({ timestamp: Date.now(), ...metrics });
  }, [addSnapshot]);

  // Take first sample immediately once we have real data
  const hasSampled = useRef(false);
  useEffect(() => {
    const hasData =
      agents.length > 0 ||
      servers.length > 0 ||
      (systemUsage?.callCount ?? 0) > 0;
    if (hasData && !hasSampled.current) {
      hasSampled.current = true;
      takeSample();
    }
  }, [agents, servers, systemUsage, takeSample]);

  // Periodic sampling
  useEffect(() => {
    const id = setInterval(takeSample, SAMPLE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [takeSample]);
}
