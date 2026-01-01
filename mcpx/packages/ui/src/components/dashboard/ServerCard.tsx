import { useDomainIcon } from "@/hooks/useDomainIcon";
import { CatalogMCPServerItem } from "@mcpx/shared-model";
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
import { isRemoteUrlValid } from "@/utils/mcpJson";

export type ServerCardProps = {
  server: CatalogMCPServerItem;
  className?: string;
  onAddServer: (
    config: Record<string, unknown>,
    serverName: string,
    needsEdit?: boolean,
  ) => void;
  status?: string;
};

interface ConfigValue {
  command?: string;
  env?: Record<string, string | { fromEnv: string }>;
  url?: string;
  type: "stdio" | "sse" | "streamable-http";
}

export const ServerCard = ({
  server,
  className,
  status,
  onAddServer,
}: ServerCardProps) => {
  const domainIconUrl = useDomainIcon(server?.name || "");

  const badges = useMemo(() => {
    function getCommand(config: Record<string, unknown>): string | undefined {
      const configValue = Object.values(config).find(
        (c) => (c as ConfigValue).command,
      ) as ConfigValue | undefined;
      return configValue?.command;
    }

    const command = getCommand(server.config ?? {});

    if (!command) {
      return ["Remote"];
    }
    {
      return ["Local", command];
    }
  }, [server]);

  function getEnvs(config: Record<string, unknown>): string[] {
    const configValue = Object.values(config ?? {}).find(
      (c) => (c as ConfigValue).env,
    ) as ConfigValue | undefined;
    return Object.keys(configValue?.env ?? {});
  }

  const envs = useMemo(() => getEnvs(server.config), [server.config]);

  function isRemoteUrlNeedEdit(config: Record<string, unknown>): boolean {
    const configValue = Object.values(config ?? {}).find(
      (c) => (c as ConfigValue).url,
    ) as ConfigValue | undefined;

    const url = configValue?.url;
    return typeof url === "string" && !isRemoteUrlValid(url);
  }

  const urlNeedsEdit = useMemo(
    () => isRemoteUrlNeedEdit(server.config),
    [server.config],
  );
  const needsEdit = !!envs.length || urlNeedsEdit;

  return (
    <div
      className={cn(
        "border flex bg-card flex-col gap-4 rounded-xl p-4",
        className,
      )}
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
            onClick={() =>
              onAddServer(server.config, server.displayName, needsEdit)
            }
          >
            <Plus className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="line-clamp-2 mb-auto text-sm font-normal text-primary">
        {server.description}
      </div>
      {!!envs?.length && (
        <div className="flex flex-col gap-1">
          <div className="text-sm text-primary font-semibold">
            ENVIRONMENT VARIABLES
          </div>
          <div className="flex flex-wrap gap-2">
            {envs.map((env) => (
              <div
                className="font-semibold text-[#5147E4] px-1.5 py-0.5 rounded bg-[#EBE6FB] text-[10px]"
                key={env}
              >
                {env}
              </div>
            ))}
          </div>
        </div>
      )}
      {urlNeedsEdit && (
        <div className="flex flex-col gap-1">
          <div className="text-sm text-primary font-semibold">PARAMETERS</div>
          <div className="flex flex-wrap gap-2">
            <div className="font-semibold text-[#5147E4] px-1.5 py-0.5 rounded bg-[#EBE6FB] text-[10px]">
              URL
            </div>
          </div>
        </div>
      )}
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
        {/* <div className="text-sm text-muted-foreground">
          {server.tools || 0} Tools
        </div> */}
      </div>
    </div>
  );
};
