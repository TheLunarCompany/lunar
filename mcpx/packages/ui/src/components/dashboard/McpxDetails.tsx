import { CardContent } from "@/components/ui/card";
import { Agent, McpServer } from "@/types";
import { formatRelativeTime } from "@/utils";
import { useMemo } from "react";
import { DashboardScrollArea } from "./DashboardScrollArea";
import { McpxAnalytics } from "./McpxAnalytics";

export type McpxDetailsProps = {
  agents: Agent[];
  servers: McpServer[];
};

export const McpxDetails = ({ agents, servers }: McpxDetailsProps) => {
  const { lastActivity, totalAgents, totalRequests } = useMemo(() => {
    const latestDate = servers?.reduce((latest, server) => {
      const lastCall = server.usage?.lastCalledAt;
      if (!lastCall) return latest;
      const lastDate = new Date(lastCall).getTime();
      return lastDate > latest ? lastDate : latest;
    }, 0);

    return {
      lastActivity: formatRelativeTime(latestDate),
      totalAgents: agents?.length || 0,
      totalRequests:
        servers?.reduce((acc, server) => acc + server.usage.callCount, 0) || 0,
    };
  }, [agents, servers]);

  return (
    <DashboardScrollArea>
      <div className="flex flex-col h-full">
        <CardContent className="p-0 flex-grow">
          <McpxAnalytics
            lastActivity={lastActivity}
            totalAgents={totalAgents}
            totalRequests={totalRequests}
          />
        </CardContent>
      </div>
    </DashboardScrollArea>
  );
};
