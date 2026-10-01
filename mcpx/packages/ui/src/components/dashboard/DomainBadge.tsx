import { Badge } from "@/components/ui/badge";
import { useDomainIcon } from "@/hooks/useDomainIcon";
import { useAccessControlsStore, useSocketStore } from "@/store";

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
          ? "border-mcpx-warning-strong bg-mcpx-warning-bg text-mcpx-warning-strong"
          : "border-[var(--mcpx-border-subtle)] bg-mcpx-surface"
      }`}
      title={
        isMissingOrInactive
          ? isMissing
            ? "Server removed or not connected"
            : "Server disabled (inactive)"
          : undefined
      }
    >
      <img src={domainIconUrl} alt="Domain Icon" className="w-4 h-4" />
      <span
        className={`text-xs capitalize font-normal leading-[18px] ${
          isMissingOrInactive
            ? "text-mcpx-warning-strong"
            : "text-[var(--mcpx-text-secondary)]"
        }`}
      >
        {domain}
      </span>
      <Badge
        variant="outline"
        className="h-auto rounded-[16px] border border-[var(--mcpx-border-subtle)] bg-[var(--mcpx-surface-subtle)] px-[6px] py-0 text-xs font-normal leading-[18px] text-[var(--mcpx-text-secondary)]"
      >
        {toolsNumber}
      </Badge>
    </Badge>
  );
};
