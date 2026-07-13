import { useMemo } from "react";
import { Check } from "lucide-react";
import {
  type CatalogMCPServerConfigByNameItem,
  isRemoteUrlNeedEdit,
} from "@mcpx/toolkit-ui/src/utils/server-helpers";
import type { CatalogConfig } from "@mcpx/shared-model";
import { Checkbox } from "@/components/ui/checkbox";
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

type McpServerCatalogCardProps = {
  server: CatalogMCPServerConfigByNameItem;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  selected?: boolean;
  className?: string;
  checkboxDisabled?: boolean;
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

function initializeEnvVarKeys(config: CatalogConfig | undefined): string[] {
  if (!config) return [];

  const keys: string[] = [];
  if (config.type === "stdio" && config.env) {
    keys.push(...Object.keys(config.env));
  }

  if (config.type !== "stdio" && isRemoteUrlNeedEdit(config)) {
    keys.push("URL");
  }

  return keys;
}

export function McpServerCatalogCard({
  server,
  checked,
  onCheckedChange,
  selected = false,
  className = "",
  checkboxDisabled = false,
}: McpServerCatalogCardProps) {
  const tags = useMemo(() => getConfigTags(server), [server]);
  const domainIconUrl = useDomainIcon(server.name);
  const serverConfig = server.config[server.name];
  const envVarKeys = useMemo(
    () => initializeEnvVarKeys(serverConfig),
    [serverConfig],
  );
  const visibleEnvVarKeys = envVarKeys.slice(0, MAX_VISIBLE_ENV_VAR_KEYS);
  const hiddenEnvVarCount = Math.max(
    0,
    envVarKeys.length - visibleEnvVarKeys.length,
  );
  const title = server.displayName || server.name;
  const description = server.description || `MCP server for ${server.name}`;
  const urlNeedsEdit = useMemo(
    () => (serverConfig ? isRemoteUrlNeedEdit(serverConfig) : false),
    [serverConfig],
  );
  const isInstalled = checkboxDisabled;
  const showCheckbox = onCheckedChange != null && !isInstalled;
  const isSelected =
    isInstalled || (showCheckbox && (checked ?? false)) || selected;
  const interactive = showCheckbox;

  const toggleSelection = (): void => {
    if (!interactive) return;
    onCheckedChange?.(!(checked ?? false));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (!interactive) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleSelection();
    }
  };

  return (
    <div
      className={cn(
        "relative flex h-full flex-col gap-3 rounded-lg border p-4 transition-all duration-300",
        isSelected
          ? "border-[#5147E4] bg-[#F7F6FE]"
          : "border-gray-200 bg-white hover:border-[#5147E4]",
        interactive && "cursor-pointer",
        className,
      )}
      onClick={toggleSelection}
      onKeyDown={handleKeyDown}
      tabIndex={interactive ? 0 : undefined}
      role={interactive ? "button" : undefined}
      aria-pressed={interactive ? isSelected : undefined}
      aria-disabled={isInstalled ? true : undefined}
      style={
        isSelected
          ? { boxShadow: "0 0 15px 0 rgba(81, 71, 228, 0.5)" }
          : undefined
      }
    >
      {isInstalled ? (
        <div className="absolute right-4 top-4 z-10 inline-flex items-center gap-1 rounded-md bg-[#7D7B98] px-2 py-0.5 text-xs font-semibold text-white shadow-sm">
          <Check className="size-3.5" />
          Installed
        </div>
      ) : showCheckbox ? (
        <div
          className="absolute right-4 top-4 z-10"
          onClick={(event) => event.stopPropagation()}
        >
          <Checkbox
            checked={checked ?? false}
            onCheckedChange={(nextChecked) =>
              onCheckedChange?.(nextChecked === true)
            }
            aria-label={`Select ${server.displayName || server.name}`}
          />
        </div>
      ) : null}

      <div
        className={cn(
          "flex items-start justify-between gap-3",
          isInstalled ? "pr-28" : "pr-8",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {domainIconUrl ? (
            <img
              src={domainIconUrl}
              alt=""
              className="h-10 w-10 shrink-0 object-contain"
            />
          ) : (
            <div className="h-10 w-10 shrink-0 rounded bg-gray-100" />
          )}
          <div className="min-w-0 flex-1">
            <TooltipProvider delayDuration={TOOLTIP_HOVER_DELAY_MS}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <h3 className="line-clamp-2 text-base font-semibold leading-5 text-gray-900">
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
                  className="w-fit rounded-[4px] border border-[#7D7B98] px-1 text-[10px] font-medium text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <TooltipProvider delayDuration={TOOLTIP_HOVER_DELAY_MS}>
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="line-clamp-2 h-9 shrink-0 text-[12px] leading-relaxed text-gray-700">
              {description}
            </p>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6} className="max-w-sm">
            {description}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {envVarKeys.length > 0 && (
        <div className="mt-auto flex min-w-0 flex-col gap-3">
          <hr className="border-border" />
          <div className="shrink-0 text-[11px] font-semibold text-[#7D7B98]">
            <div className="flex min-w-0 items-center gap-2 overflow-hidden">
              <span className="shrink-0">
                {urlNeedsEdit ? "PARAMETERS" : "ENV. VARS"}
              </span>
              <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-hidden">
                {visibleEnvVarKeys.map((key) => (
                  <div
                    key={key}
                    className="min-w-0 max-w-[128px] truncate rounded bg-[#EBE6FB] px-1.5 py-0 text-[9px] font-semibold leading-4 text-[#5147E4]"
                    title={key}
                  >
                    {key}
                  </div>
                ))}
                {hiddenEnvVarCount > 0 && (
                  <div
                    className="shrink-0 text-[11px] font-semibold text-[#7D7B98]"
                    title={envVarKeys
                      .slice(MAX_VISIBLE_ENV_VAR_KEYS)
                      .join(", ")}
                  >
                    +{hiddenEnvVarCount}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
