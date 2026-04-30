import { Badge } from "@/components/ui/badge";
import { useDomainIcon } from "@/hooks/useDomainIcon";
import { useAccessControlsStore, useSocketStore } from "@/store";
import McpIcon from "./SystemConnectivity/nodes/Mcpx_Icon.svg?react";

export const DomainBadge = ({
  domain,
  groupId,
}: {
  domain: string;
  groupId: string;
}) => {
  const { systemState, appConfig } = useSocketStore((s) => ({
    systemState: s.systemState,
    appConfig: s.appConfig,
  }));

  const { toolGroups } = useAccessControlsStore((s) => {
    return {
      toolGroups: s.toolGroups || [],
    };
  });

  const toolGroup = toolGroups.find((group) => group.id === groupId);

  const server = systemState?.targetServers?.find((s) => s.name === domain);
  const isMissing = !server;
  const isInactive =
    appConfig?.targetServerAttributes?.[domain]?.inactive === true;
  const isMissingOrInactive = isMissing || isInactive;

  const domainIconUrl = useDomainIcon(domain);

  const toolsNumber = toolGroup?.services[domain]?.length;

  return (
    <Badge
      variant="outline"
      className={`flex h-[30px] items-center gap-1 rounded-[4px] border px-2 py-1 ${
        isMissingOrInactive
          ? "bg-(--color-bg-attention) border-(--color-border-attention) text-(--color-fg-attention)"
          : "border-[var(--colors-gray-200)] bg-white"
      }`}
      title={
        isMissingOrInactive
          ? isMissing
            ? "Server removed or not connected"
            : "Server disabled (inactive)"
          : undefined
      }
    >
      {domainIconUrl ? (
        <img src={domainIconUrl} alt="Domain Icon" className="w-4 h-4" />
      ) : (
        <McpIcon style={{ color: server?.icon }} className="w-4 h-4" />
      )}
      <span
        className={`text-xs capitalize font-normal leading-[18px] ${
          isMissingOrInactive
            ? "text-(--color-fg-attention)"
            : "text-[var(--colors-gray-600)]"
        }`}
      >
        {domain}
      </span>
      <Badge
        variant="outline"
        className={`h-auto rounded-[16px] border px-[6px] py-0 text-xs font-normal leading-[18px] ${
          isMissingOrInactive
            ? "bg-(--color-bg-danger) text-destructive"
            : "border-[var(--colors-gray-200)] bg-[var(--colors-gray-50)] text-[var(--colors-gray-600)]"
        }`}
      >
        {toolsNumber}
      </Badge>
    </Badge>
  );
};
