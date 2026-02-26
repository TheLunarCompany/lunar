import { useDomainIcon } from "@/hooks/useDomainIcon";
import McpIcon from "./SystemConnectivity/nodes/Mcpx_Icon.svg?react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { useMemo } from "react";
import { Plus } from "lucide-react";
import GitHubLogo from "./icons/GitHubLogo.svg?react";
import GitHubLogoSolid from "./icons/GitHubLogoSolid.svg?react";
import {
  getServerStatusBackgroundColor,
  getServerStatusText,
  getServerStatusTextColor,
} from "./helpers";
import { getMcpColorByName } from "./constants";
import { isRemoteUrlValid } from "@mcpx/toolkit-ui/src/utils/mcpJson";
import {
  CatalogMCPServerConfigByNameItem,
  convertRequirementsToValues,
} from "@mcpx/toolkit-ui/src/utils/server-helpers";
import { CatalogConfig, EnvValue } from "@mcpx/shared-model";
import { useToast } from "@/components/ui/use-toast";

export type ServerCardProps = {
  server: CatalogMCPServerConfigByNameItem;
  className?: string;
  onAddServer: (
    config: Record<string, unknown>,
    serverName: string,
    needsEdit?: boolean,
  ) => void;
  status?: string;
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

  const badges = useMemo(() => {
    const config = server.config[server.name];

    if (config.type === "stdio") {
      const command = config.command;
      return ["Local", command];
    }
    return ["Remote"];
  }, [server]);

  const envVarKeys = useMemo(
    () => initializeEnvVarKeys(server.config[server.name]),
    [server.config, server.name],
  );

  const urlNeedsEdit = useMemo(
    () => isRemoteUrlNeedEdit(server.config[server.name]),
    [server.config, server.name],
  );

  const handleAddServer = () => {
    const currentTargetServerData = server.config[server.name];

    if (currentTargetServerData.type === "stdio") {
      const finalEnv: Record<string, EnvValue> = convertRequirementsToValues(
        currentTargetServerData.env,
      );
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
      );
    }
  };

  return (
    <div
      className={cn("border flex flex-col gap-4 rounded-xl p-4", className)}
      style={{ backgroundColor: "#F3F5FA" }}
    >
      <div className="flex items-start justify-between gap-2 text-foreground font-semibold">
        <div className="flex items-center gap-2">
          <div>
            {domainIconUrl ? (
              <img
                src={domainIconUrl}
                alt="Domain Icon"
                className="min-w-12 h-12 rounded-md object-contain p-1 "
              />
            ) : (
              <McpIcon
                style={{ color: getMcpColorByName(server.displayName) }}
                className="min-w-12 h-12 rounded-md p-1"
              />
            )}
          </div>
          <div className="flex flex-col">
            <span>{server.displayName}</span>
            <div className="flex items-center gap-1">
              {badges.map((badge, index) => (
                <p
                  key={index}
                  className="text-[10px] w-fit font-semibold text-muted-foreground border border-[#7D7B98] rounded-[4px] px-1"
                >
                  {badge}
                </p>
              ))}
            </div>
          </div>
        </div>

        {status && (
          <div
            className={`flex whitespace-nowrap gap-1 overflow-hidden  items-center h-6  px-2 rounded-full text-xs font-medium  ${getServerStatusBackgroundColor(status)} ${getServerStatusTextColor(status)} `}
          >
            <div className="bg-current w-2 min-w-2 h-2 min-h-2 rounded-full"></div>
            <span className="line-clamp-1 text-ellipsis">
              {getServerStatusText(status)}
            </span>
          </div>
        )}
        {!status && (
          <Button
            className="text-lg max-w-6 max-h-6 px-1.5 py-1.5 font-normal"
            variant="primary"
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

      <div className="line-clamp-2 mb-auto text-sm font-normal text-primary">
        {server.description}
      </div>

      <div className="flex-1 flex flex-col gap-2">
        {/* Headers and cancel button */}
        {envVarKeys.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-primary font-semibold">
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
      <div className="flex items-center justify-between">
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
