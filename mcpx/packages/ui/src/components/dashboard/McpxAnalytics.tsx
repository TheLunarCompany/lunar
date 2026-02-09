import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, BarChart3, Users } from "lucide-react";

export type McpxAnalyticsProps = {
  lastActivity: string;
  totalRequests: number;
  totalAgents: number;
};

export const McpxAnalytics = ({
  lastActivity,
  totalRequests,
  totalAgents,
}: McpxAnalyticsProps) => {
  return (
    <div className="px-3 py-2 space-y-5 max-w-full mx-auto bg-[var(--color-bg-app)] text-[var(--color-text-primary)]">
      <div className="flex gap-6 flex-wrap justify-start items-start">
        <Card className="bg-background border-[var(--color-border-primary)] w-[300px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
            <CardTitle className="text-sm text-[var(--color-text-primary)]">
              Total Requests
            </CardTitle>
            <BarChart3 className="h-5 w-5 text-[var(--color-data-series-1)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[var(--color-text-primary)]">
              {totalRequests.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-background border-[var(--color-border-primary)] w-[300px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
            <CardTitle className="text-[var(--color-text-primary)]">
              Active Agents
            </CardTitle>
            <Users className="h-5 w-5 text-[var(--color-data-series-2)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[var(--color-text-primary)]">
              {totalAgents.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-background border-[var(--color-border-primary)] w-[300px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
            <CardTitle className="text-[var(--color-text-primary)]">
              Last Activity
            </CardTitle>
            <Activity className="h-5 w-5 text-[var(--color-fg-success)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[var(--color-text-primary)]">
              {lastActivity}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
