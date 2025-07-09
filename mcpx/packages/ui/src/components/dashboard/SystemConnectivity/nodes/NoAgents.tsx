import { Card } from "@/components/ui/card";
import { Brain } from "lucide-react";
import { memo } from "react";

const NoAgents = () => {
  return (
    <Card className="p-1 w-20 border-dashed border-[var(--color-border-primary)] bg-[var(--color-bg-container)]">
      <div className="flex flex-col items-center gap-0.5 text-[var(--color-text-disabled)]">
        <Brain className="w-2.5 h-2.5" />
        <p className="text-[7px] font-medium">No agents</p>
      </div>
    </Card>
  );
};

export default memo(NoAgents);
