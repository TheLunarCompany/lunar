import { Card, CardContent } from "@/components/ui/card";
import { Agent, McpServer } from "@/types";
import { isActive } from "@/utils";
import { Wrench, Server, Bot, Network, Clock } from "lucide-react";

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
  // Calculate metrics
  const connectedTools = servers.reduce(
    (total, server) => total + server.tools.length,
    0,
  );
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
    ? isActive(systemUsage.lastCalledAt)
      ? "Active"
      : new Date(systemUsage.lastCalledAt).toLocaleString()
    : "N/A";

  const metrics = [
    {
      label: "Connected Tools",
      value: connectedTools,
      icon: Wrench,
      iconColor: "text-purple-600",
    },
    {
      label: "Connected MCP servers",
      value: connectedMcpServers,
      icon: Server,
      iconColor: "text-purple-600",
    },
    {
      label: "Active Agents",
      value: activeAgents,
      icon: Bot,
      iconColor: "text-purple-600",
    },
    {
      label: "Total Requests",
      value: totalRequests,
      icon: Network,
      iconColor: "text-purple-600",
    },
    {
      label: "Last Activity",
      value: lastActivity,
      icon: Clock,
      iconColor: "text-purple-600",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="text-lg font-bold">Dashboard</div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {metrics.map((metric, index) => {
          const IconComponent = metric.icon;
          return (
            <Card
              key={index}
              className="bg-white border-2 shadow-sm rounded-lg"
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <IconComponent className={`w-4 h-4 text-component-primary`} />
                  <div className="text-xs font-medium ">
                    {metric.label}
                  </div>
                </div>
                <div
                  className={`${metric.label === "Last Activity" ? "text-sm" : "text-2xl"} font-bold text-component-primary `}
                >
                  {metric.value}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
