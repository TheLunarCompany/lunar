import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { MessageSquareText, Wrench } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

type SkillCardMetricsProps = ComponentPropsWithoutRef<"div"> & {
  toolsCount: number;
  promptsCount: number;
};

export function SkillCardMetrics({
  toolsCount,
  promptsCount,
  className,
  ...props
}: SkillCardMetricsProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 text-[11px] font-semibold leading-none text-[var(--text-colours-color-text-primary)]",
        className,
      )}
      {...props}
    >
      <SkillCardMetric
        icon={<Wrench className="size-3.5" />}
        value={toolsCount}
        label="Tools"
      />
      <SkillCardMetric
        icon={<MessageSquareText className="size-3.5" />}
        value={promptsCount}
        label="Prompts"
      />
      {/*
      <SkillCardMetric
        icon={<Box className="size-3.5" />}
        value={resourcesCount}
        label="Resources"
      />
      */}
    </div>
  );
}

function SkillCardMetric({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: number;
  label: string;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            aria-label={`${label}: ${value}`}
            className="flex items-center gap-1"
          >
            <span className="grid size-4 place-items-center text-[var(--text-colours-color-text-secondary)]">
              {icon}
            </span>
            <span>{value}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4} className="z-[9999]">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
