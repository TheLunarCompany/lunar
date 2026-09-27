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
    <div className="px-3 py-2 space-y-5 max-w-full mx-auto bg-background text-foreground">
      <div className="flex gap-6 flex-wrap justify-start items-start">
        <Card className="bg-background border-border w-[300px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
            <CardTitle className="text-sm text-foreground">
              Total Requests
            </CardTitle>
            <BarChart3 className="h-5 w-5 text-(--color-data-series-1)" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {totalRequests.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-background border-border w-[300px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
            <CardTitle className="text-foreground">Active Agents</CardTitle>
            <Users className="h-5 w-5 text-(--color-data-series-2)" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {totalAgents.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-background border-border w-[300px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
            <CardTitle className="text-foreground">Last Activity</CardTitle>
            <Activity className="h-5 w-5 text-(--color-fg-success)" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {lastActivity}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
