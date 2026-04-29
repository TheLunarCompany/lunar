import { MetricCard } from "@/components/ui/metric-card";
import { Agent, McpServer } from "@/types";
import { isActive } from "@/utils";
import { format } from "date-fns";
import { Bot, Clock, Hammer, Network, Server } from "lucide-react";
import { useToolsMetric } from "./ToolsMetric";

interface MetricsPanelProps {
  agents: Agent[];
  servers: McpServer[];
  systemUsage?: {
    callCount: number;
    lastCalledAt?: Date;
  };
}

export const MetricsPanel = ({
  agents,
  servers,
  systemUsage,
}: MetricsPanelProps) => {
  const toolsValue = useToolsMetric({ agents, servers });
  const allToolsValue = toolsValue.includes("/")
    ? toolsValue.split("/")[1]
    : toolsValue;

  const connectedMcpServers = servers.filter(
    (server) =>
      server.status === "connected_running" ||
      server.status === "connected_stopped",
  ).length;
  const activeAgents = agents.filter(
    (agent) => agent.status === "connected" && isActive(agent.lastActivity),
  ).length;
  const totalRequests = systemUsage?.callCount || 0;
  const lastActivity = systemUsage?.lastCalledAt
    ? format(systemUsage.lastCalledAt, "MMM d, HH:mm")
    : "N/A";

  const metrics = [
    {
      label: "Tools",
      value: allToolsValue,
      icon: Hammer,
    },
    {
      label: "Connected MCP servers",
      value: connectedMcpServers,
      icon: Server,
    },
    {
      label: "Active Agents",
      value: activeAgents,
      icon: Bot,
    },
    {
      label: "Total Requests",
      value: totalRequests,
      icon: Network,
    },
    {
      label: "Last Activity",
      value: lastActivity,
      icon: Clock,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="text-xl font-semibold text-[var(--colors-primary-950)]">
        Dashboard
      </div>
      <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(min(100%,210px),1fr))] gap-4">
        {metrics.map((metric, index) => {
          const IconComponent = metric.icon;
          return (
            <MetricCard
              key={index}
              label={metric.label}
              value={metric.value}
              icon={<IconComponent className="size-5" strokeWidth={1.75} />}
            />
          );
        })}
      </div>
    </div>
  );
};
