import { cn } from "@/lib/utils";
import type { McpServerType } from "@/types";

type ServerCatalogBadgesProps = {
  type: McpServerType;
  command?: string;
  className?: string;
};

function getServerCatalogBadgeLabels(type: McpServerType, command?: string) {
  if (type === "stdio") {
    return ["Local", command].filter(Boolean);
  }

  return ["Remote"];
}

export function ServerCatalogBadges({
  type,
  command,
  className,
}: ServerCatalogBadgesProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {getServerCatalogBadgeLabels(type, command).map((badge) => (
        <p
          key={badge}
          className="text-[10px] w-fit font-semibold text-muted-foreground border border-[#7D7B98] rounded-[4px] px-1"
        >
          {badge}
        </p>
      ))}
    </div>
  );
}
