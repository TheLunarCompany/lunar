import { CardContent } from "@/components/ui/card";
import { DashboardScrollArea } from "./DashboardScrollArea";
import { McpxAnalytics } from "./McpxAnalytics";

export const McpxDetails = ({
  aiAgents,
  configurationData,
}: {
  aiAgents: any[];
  configurationData: any;
}) => {
  return (
    <DashboardScrollArea>
      <div className="flex flex-col h-full">
        <CardContent className="p-0 flex-grow">
          <McpxAnalytics
            configurationData={configurationData}
            aiAgents={aiAgents}
          />
        </CardContent>
      </div>
    </DashboardScrollArea>
  );
};
