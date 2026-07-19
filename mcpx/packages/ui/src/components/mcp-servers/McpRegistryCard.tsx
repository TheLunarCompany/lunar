import { Plus } from "lucide-react";
import type { EnvValue } from "@mcpx/shared-model";
import {
  type CatalogMCPServerConfigByNameItem,
  isRemoteUrlNeedEdit,
} from "@mcpx/toolkit-ui/src/utils/server-helpers";
import { convertRequirementsToValues } from "@mcpx/toolkit-ui/src/utils/env-vars-utils";
import { ServerStatusBadge } from "@/components/dashboard/ServerStatusBadge";
import { McpCard } from "@/components/mcp-servers/McpCard";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import type { McpServerStatus } from "@/types";

export type McpRegistryCardProps = {
  server: CatalogMCPServerConfigByNameItem;
  className?: string;
  onAddServer: (
    config: Record<string, unknown>,
    serverName: string,
    needsEdit?: boolean,
    catalogItemId?: string,
  ) => void;
  status?: McpServerStatus;
};

export function McpRegistryCard({
  server,
  className,
  status,
  onAddServer,
}: McpRegistryCardProps) {
  const { toast } = useToast();
  const serverConfig = server.config[server.name];
  const urlNeedsEdit = isRemoteUrlNeedEdit(serverConfig);

  const handleAddServer = (): void => {
    if (serverConfig.type === "stdio") {
      const finalEnv: Record<string, EnvValue> = convertRequirementsToValues(
        serverConfig.env ?? {},
      );
      const updatedTargetServerData = {
        ...serverConfig,
        env: finalEnv,
      };

      toast({
        title: `Adding ${server.name}...`,
        variant: "server-info",
      });
      onAddServer(
        { [server.name]: updatedTargetServerData },
        server.displayName,
        false,
        server.id,
      );
      return;
    }

    const updatedTargetServerData = urlNeedsEdit
      ? {
          ...serverConfig,
          url:
            serverConfig.type === "streamable-http"
              ? "https://edit-this-url.com/mcp"
              : "https://www.edit-this-url.com/sse",
        }
      : serverConfig;

    toast({
      title: `Adding ${server.name}...`,
      variant: "server-info",
    });
    onAddServer(
      { [server.name]: updatedTargetServerData },
      server.displayName,
      false,
      server.id,
    );
  };

  const action = status ? (
    <ServerStatusBadge status={status} />
  ) : (
    <Button
      className="max-h-6 max-w-6 px-1.5 py-1.5 text-lg font-normal"
      variant="default"
      size="sm"
      aria-label={`Add ${server.displayName}`}
      onClick={(event) => {
        event.stopPropagation();
        handleAddServer();
      }}
    >
      <Plus />
    </Button>
  );

  return <McpCard server={server} action={action} className={className} />;
}
