import { getAgentIcon } from "@/lib/agent-icons";
import { cn } from "@/lib/utils";

export function SkillAgentIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const label = name.trim() || "Agent";

  return (
    <img
      src={getAgentIcon(label)}
      alt={`${label} logo`}
      className={cn("size-5 shrink-0 rounded-md object-contain", className)}
    />
  );
}
