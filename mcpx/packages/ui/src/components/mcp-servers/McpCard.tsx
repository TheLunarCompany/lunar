import { useMemo, type ComponentProps, type ReactNode } from "react";
import type { CatalogConfig } from "@mcpx/shared-model";
import {
  type CatalogMCPServerConfigByNameItem,
  isRemoteUrlNeedEdit,
} from "@mcpx/toolkit-ui/src/utils/server-helpers";
import {
  TOOLTIP_HOVER_DELAY_MS,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDomainIcon } from "@/hooks/useDomainIcon";
import { cn } from "@/lib/utils";

const MAX_VISIBLE_ENV_VAR_KEYS = 3;

type McpCardProps = Omit<ComponentProps<"div">, "children"> & {
  server: CatalogMCPServerConfigByNameItem;
  action?: ReactNode;
  selected?: boolean;
};

function getConfigTags(server: CatalogMCPServerConfigByNameItem): string[] {
  const config = server.config[server.name];
  if (!config) return [];

  const tags: string[] = [];
  if (config.type === "stdio") {
    if (config.command === "npx") tags.push("NPX");
    else if (config.command === "uvx") tags.push("UVX");
    else if (config.command === "docker") tags.push("Docker");
    tags.push("Local");
  } else {
    tags.push("Remote");
  }
  return tags;
}

function getEnvVarKeys(config: CatalogConfig | undefined): string[] {
  if (!config) return [];

  const keys =
    config.type === "stdio" && config.env ? Object.keys(config.env) : [];
  if (config.type !== "stdio" && isRemoteUrlNeedEdit(config)) {
    keys.push("URL");
  }
  return keys;
}

export function McpCard({
  server,
  action,
  selected = false,
  className,
  style,
  ...props
}: McpCardProps) {
  const tags = useMemo(() => getConfigTags(server), [server]);
  const domainIconUrl = useDomainIcon(server.name);
  const serverConfig = server.config[server.name];
  const envVarKeys = useMemo(() => getEnvVarKeys(serverConfig), [serverConfig]);
  const visibleEnvVarKeys = envVarKeys.slice(0, MAX_VISIBLE_ENV_VAR_KEYS);
  const hiddenEnvVarCount = envVarKeys.length - visibleEnvVarKeys.length;
  const title = server.displayName || server.name;
  const description = server.description || `MCP server for ${server.name}`;
  const urlNeedsEdit =
    serverConfig != null &&
    serverConfig.type !== "stdio" &&
    isRemoteUrlNeedEdit(serverConfig);

  return (
    <div
      className={cn(
        "relative flex h-full flex-col gap-3 rounded-lg border p-4 transition-all duration-300",
        selected
          ? "border-mcpx-selected bg-mcpx-selected-weak shadow-[var(--mcpx-shadow-moderate)]"
          : "border-mcpx-border-subtle bg-mcpx-surface hover:border-mcpx-selected",
        className,
      )}
      style={style}
      {...props}
    >
      <div className="flex items-start gap-3">
        {domainIconUrl ? (
          <img
            src={domainIconUrl}
            alt=""
            className="size-10 shrink-0 object-contain"
          />
        ) : (
          <div className="size-10 shrink-0 rounded bg-mcpx-page0" />
        )}
        <div className="min-w-0 flex-1">
          <TooltipProvider delayDuration={TOOLTIP_HOVER_DELAY_MS}>
            <Tooltip>
              <TooltipTrigger asChild>
                <h3 className="line-clamp-2 text-base font-semibold leading-5 text-mcpx-text">
                  {title}
                </h3>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>
                {title}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="w-fit rounded-[4px] border border-mcpx-border px-1 text-[10px] font-medium text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        {action && <div className="ml-auto shrink-0">{action}</div>}
      </div>

      <TooltipProvider delayDuration={TOOLTIP_HOVER_DELAY_MS}>
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="line-clamp-2 h-9 shrink-0 text-xs leading-relaxed text-mcpx-text-secondary">
              {description}
            </p>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6} className="max-w-sm">
            {description}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="mt-auto flex min-h-7 min-w-0 flex-col gap-3">
        {envVarKeys.length > 0 && (
          <>
            <hr className="border-border" />
            <div className="flex min-w-0 items-center gap-2 overflow-hidden text-[11px] font-semibold text-mcpx-text-secondary">
              <span className="shrink-0">
                {urlNeedsEdit ? "PARAMETERS" : "ENV. VARS"}
              </span>
              <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-hidden">
                {visibleEnvVarKeys.map((key) => (
                  <div
                    key={key}
                    className="min-w-0 max-w-32 truncate rounded bg-mcpx-selected-weak px-1.5 text-[9px] font-semibold leading-4 text-mcpx-selected"
                    title={key}
                  >
                    {key}
                  </div>
                ))}
                {hiddenEnvVarCount > 0 && (
                  <div
                    className="shrink-0"
                    title={envVarKeys
                      .slice(MAX_VISIBLE_ENV_VAR_KEYS)
                      .join(", ")}
                  >
                    +{hiddenEnvVarCount}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
