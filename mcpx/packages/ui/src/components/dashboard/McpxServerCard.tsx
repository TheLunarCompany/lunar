import { Card, CardContent } from "@/components/ui/card";
import McpIcon from "./SystemConnectivity/nodes/Mcpx_Icon.svg?react";
import { Switch } from "@/components/ui/switch";
import { useMemo } from "react";
import { useSocketStore } from "@/store";
import { useDomainIcon } from "@/hooks/useDomainIcon";
import { type NextVersionAppConfig } from "@mcpx/shared-model";
import {
  getServerStatusText,
  getServerStatusTextColor,
  getServerStatusBackgroundColor,
} from "./helpers";

export interface McpxServerCardProps {
  server: {
    name: string;
    toolsCount: number;
    icon?: string;
    status?: string;
  };
  pendingToggle?: boolean;
  onToggleChange: (checked: boolean | undefined) => void;
}

export const McpxServerCard = ({
  server,
  pendingToggle,
  onToggleChange,
}: McpxServerCardProps) => {
  const domainIconUrl = useDomainIcon(server.name);
  const { appConfig } = useSocketStore((s) => ({
    appConfig: s.appConfig,
  }));

  const isActive = useMemo(() => {
    if (pendingToggle !== undefined) {
      return pendingToggle;
    }

    const appConfigTyped = appConfig as
      | (NextVersionAppConfig & {
          targetServerAttributes?: Record<string, { inactive: boolean }>;
        })
      | null;
    if (!appConfigTyped) {
      return true;
    }

    const targetServerAttributes = appConfigTyped.targetServerAttributes ?? {};
    const normalizedServerName = server.name.toLowerCase().trim();

    let serverAttributes = targetServerAttributes[normalizedServerName];
    if (!serverAttributes) {
      const matchingKey = Object.keys(targetServerAttributes).find(
        (key) => key.toLowerCase().trim() === normalizedServerName,
      );
      if (matchingKey) {
        serverAttributes = targetServerAttributes[matchingKey];
      }
    }

    return serverAttributes?.inactive !== true;
  }, [appConfig, server.name, pendingToggle]);

  return (
    <Card className="border bg-white">
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0">
            {domainIconUrl ? (
              <img
                src={domainIconUrl}
                alt="Server Icon"
                className="min-w-8 w-8 min-h-8 h-8 rounded-md object-contain p-1 bg-white"
              />
            ) : (
              <McpIcon
                style={{ color: server.icon }}
                className="min-w-8 w-8 min-h-8 h-8 rounded-md bg-white p-1"
              />
            )}
          </div>
          <div className="flex-1 flex-row min-w-0">
            <h3 className="capitalize font-semibold text-[var(--color-text-primary)] mb-0 text-sm truncate">
              {server.name}
            </h3>
            {(server.status === "pending-auth" ||
              server.status === "connection-failed") && (
              <div
                className={`flex w-fit gap-1 overflow-hidden items-center h-5 px-2 rounded-full text-xs font-medium  ${getServerStatusBackgroundColor(server.status)} ${getServerStatusTextColor(server.status)}`}
              >
                <div className="bg-current w-1.5 min-w-1.5 h-1.5 min-h-1.5 rounded-full"></div>
                <span className="line-clamp-1 text-ellipsis text-[10px]">
                  {getServerStatusText(server.status)}
                </span>
              </div>
            )}
          </div>
          <div className="flex-shrink-0">
            <Switch checked={isActive} onCheckedChange={onToggleChange} />
          </div>
        </div>
        <p className="text-[10px] font-semibold text-[var(--color-text-secondary)] pl-1  mt-1">
          {server.toolsCount} Tools
        </p>
      </CardContent>
    </Card>
  );
};
