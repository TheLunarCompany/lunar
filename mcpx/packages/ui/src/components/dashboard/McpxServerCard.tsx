import { Card, CardContent } from "@/components/ui/card";
import McpIcon from "./SystemConnectivity/nodes/Mcpx_Icon.svg?react";
import { Switch } from "@/components/ui/switch";
import { useMemo } from "react";
import { useSocketStore } from "@/store";
import { useDomainIcon } from "@/hooks/useDomainIcon";
import { type AppConfig } from "@mcpx/shared-model";
import { ServerStatusBadge } from "./ServerStatusBadge";
import { ServerCatalogBadges } from "./ServerCatalogBadges";
import {
  SERVER_STATUS,
  type McpServerStatus,
  type McpServerType,
} from "@/types";

export interface McpxServerCardProps {
  server: {
    name: string;
    toolsCount: number;
    icon?: string;
    status?: McpServerStatus;
    type: McpServerType;
    command?: string;
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
      | (AppConfig & {
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

  const status = useMemo(() => {
    if (
      !isActive &&
      (server.status === SERVER_STATUS.connected_running ||
        server.status === SERVER_STATUS.connected_stopped)
    ) {
      return SERVER_STATUS.connected_inactive;
    }

    return server.status;
  }, [isActive, server.status]);

  return (
    <Card className="gap-0 rounded-lg bg-(--colors-gray-50) p-3 py-3 shadow-none ring-0">
      <CardContent className="p-0">
        <div className="flex items-center gap-2">
          <div className="shrink-0">
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
            <h3 className="capitalize font-semibold text-foreground mb-0 text-sm truncate">
              {server.name}
            </h3>
            <div className={"flex mt-1 items-center"}>
              <p className="text-[10px] font-semibold text-muted-foreground">
                {server.toolsCount} Tools
              </p>
              <ServerCatalogBadges
                type={server.type}
                command={server.command}
                className="ml-2"
              />
            </div>
            {status && <ServerStatusBadge status={status} className="mt-2" />}
          </div>
          <div className="shrink-0">
            <Switch checked={isActive} onCheckedChange={onToggleChange} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
