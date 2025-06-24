import { CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";
import { AgentControls } from "./AgentControls";
import { DashboardScrollArea } from "./DashboardScrollArea";

export const AgentsDetails = ({
  aiAgents,
  selectedAgent,
}: {
  aiAgents: any[];
  selectedAgent?: any;
}) => {
  if (!aiAgents?.length || !selectedAgent)
    return (
      <DashboardScrollArea>
        <div className="h-full flex items-center justify-center p-4">
          <div className="text-center text-[var(--color-text-secondary)]">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              {!aiAgents?.length
                ? "No Agents"
                : "Select an AI Agent from the diagram to configure access controls"}
            </p>
          </div>
        </div>
      </DashboardScrollArea>
    );

  return (
    <DashboardScrollArea>
      <div className="flex flex-col h-full">
        <CardContent className="p-0 flex-grow overflow-hidden">
          <div className="h-full">
            <AgentControls agent={selectedAgent} />
          </div>
        </CardContent>
      </div>
    </DashboardScrollArea>
  );
};
