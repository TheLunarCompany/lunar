import { useDomainIcon } from "@/hooks/useDomainIcon";
import McpIcon from "./SystemConnectivity/nodes/Mcpx_Icon.svg?react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { useMemo } from "react";
import { Plus } from "lucide-react";
import GitHubLogo from "./icons/GitHubLogo.svg?react";
import GitHubLogoSolid from "./icons/GitHubLogoSolid.svg?react";
import { getMcpColorByName } from "./constants";
import { ServerStatusBadge } from "./ServerStatusBadge";
import { ServerCatalogBadges } from "./ServerCatalogBadges";
import { isRemoteUrlValid } from "@mcpx/toolkit-ui/src/utils/mcpJson";
import { CatalogMCPServerConfigByNameItem } from "@mcpx/toolkit-ui/src/utils/server-helpers";
import { CatalogConfig, EnvValue } from "@mcpx/shared-model";
import { useToast } from "@/components/ui/use-toast";
import { convertRequirementsToValues } from "@mcpx/toolkit-ui/src/utils/env-vars-utils";
import type { McpServerStatus } from "@/types";

export type ServerCardProps = {
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

function initializeEnvVarKeys(config: CatalogConfig): string[] {
  const keys: string[] = [];
  if (config.type === "stdio" && config.env) {
    for (const key of Object.keys(config.env)) {
      keys.push(key);
    }
  }
  // handle url as parameter case
  if (config.type !== "stdio" && isRemoteUrlNeedEdit(config)) {
    keys.push("URL");
  }
  return keys;
}

function isRemoteUrlNeedEdit(config: CatalogConfig): boolean {
  if (config.type !== "stdio") {
    return !isRemoteUrlValid(config.url);
  }
  return false; // if not remote, no url to edit
}

export const ServerCard = ({
  server,
  className,
  status,
  onAddServer,
}: ServerCardProps) => {
  const domainIconUrl = useDomainIcon(server?.name || "");
  const { toast } = useToast();
  const serverConfig = server.config[server.name];
  const envVarKeys = useMemo(
    () => initializeEnvVarKeys(serverConfig),
    [serverConfig],
  );

  const urlNeedsEdit = useMemo(
    () => isRemoteUrlNeedEdit(serverConfig),
    [serverConfig],
  );

  const handleAddServer = () => {
    const currentTargetServerData = server.config[server.name];

    if (currentTargetServerData.type === "stdio") {
      const envWithRequirements = currentTargetServerData.env
        ? currentTargetServerData.env
        : {};
      const finalEnv: Record<string, EnvValue> =
        convertRequirementsToValues(envWithRequirements);
      const updatedTargetServerData = {
        ...currentTargetServerData,
        ...(currentTargetServerData.type === "stdio"
          ? { env: finalEnv }
          : { url: finalEnv.URL }),
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
    } else {
      // remote server, edit only if the url needs it

      const updatedTargetServerData = urlNeedsEdit
        ? {
            ...currentTargetServerData,
            // change the placeholder to fake yet valid server url to pass validation
            url:
              currentTargetServerData.type === "streamable-http"
                ? "https://edit-this-url.com/mcp"
                : "https://www.edit-this-url.com/sse",
          }
        : currentTargetServerData;

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
    }
  };

  return (
    <div
      className={cn(
        "relative flex flex-col gap-4 rounded-xl border bg-white p-4",
        className,
      )}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-2 pr-8 text-foreground font-semibold xl:grid-cols-[auto_minmax(0,1fr)_auto]">
        <div className="row-start-1 flex h-10 shrink-0 items-center justify-center">
          {domainIconUrl ? (
            <img
              src={domainIconUrl}
              alt="Domain Icon"
              className="h-10 w-10 object-contain"
            />
          ) : (
            <McpIcon
              style={{ color: getMcpColorByName(server.displayName) }}
              className="h-10 w-10"
            />
          )}
        </div>
        <div className="col-start-2 row-start-1 flex min-w-0 flex-col">
          <span
            className="line-clamp-2 wrap-break-word"
            title={server.displayName}
          >
            {server.displayName}
          </span>
          <ServerCatalogBadges
            type={serverConfig.type}
            command={
              serverConfig.type === "stdio" ? serverConfig.command : undefined
            }
          />
        </div>

        {status && (
          <ServerStatusBadge
            status={status}
            className="col-start-2 row-start-2 justify-self-start xl:col-start-3 xl:row-start-1 xl:max-w-none xl:justify-self-end"
          />
        )}
        {!status && (
          <Button
            className="absolute right-4 top-4 max-h-6 max-w-6 px-1.5 py-1.5 text-lg font-normal"
            variant="default"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleAddServer();
            }}
          >
            <Plus className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="line-clamp-2 mb-auto text-sm font-normal text-foreground">
        {server.description}
      </div>

      <div className="flex-1 flex flex-col gap-2">
        {/* Headers and cancel button */}
        {envVarKeys.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-foreground">
              {urlNeedsEdit ? "PARAMETERS" : "ENVIRONMENT VARIABLES"}
            </div>
          </div>
        )}
        {/* Static env vars tags */}
        <div className="flex flex-wrap gap-2">
          {envVarKeys.map((key) => (
            <div
              key={key}
              className="font-semibold text-[#5147E4] px-1.5 py-0.5 rounded bg-[#EBE6FB] text-[10px]"
            >
              {key}
            </div>
          ))}
        </div>
      </div>

      <hr className="border-border" />
      <div className="flex min-h-5 items-center justify-between">
        <div className="flex items-center gap-1 text-muted-foreground">
          {server.link && (
            <a href={server.link} target="_blank" rel="noopener noreferrer">
              {server.link.includes("github.com") &&
              !server.link.includes("github.io") ? (
                <GitHubLogoSolid />
              ) : (
                <span className="flex items-center gap-1 text-sm font-normal">
                  <GitHubLogo /> Docs
                </span>
              )}
            </a>
          )}
          {server.doc && (
            <a
              href={server.doc}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm font-normal"
            >
              <GitHubLogo /> Docs
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
