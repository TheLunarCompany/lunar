import { useDomainIcon } from "@/hooks/useDomainIcon";
import McpIcon from "./SystemConnectivity/nodes/Mcpx_Icon.svg?react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { useState, useMemo, useEffect } from "react";
import { Check, X, Eye, EyeOff, Plus } from "lucide-react";
import GitHubLogo from "./icons/GitHubLogo.svg?react";
import GitHubLogoSolid from "./icons/GitHubLogoSolid.svg?react";
import {
  getServerStatusBackgroundColor,
  getServerStatusText,
  getServerStatusTextColor,
} from "./helpers";
import { getMcpColorByName } from "./constants";
import { isRemoteUrlValid } from "@mcpx/toolkit-ui/src/utils/mcpJson";
import { CatalogMCPServerConfigByNameItem } from "@mcpx/toolkit-ui/src/utils/server-helpers";

interface ServerCardState {
  isEditing: boolean;
  selectedKey: string;
  keyValuePairs: Record<string, string>;
  currentValue: string;
  showValue: boolean;
}

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
  const [cardState, setCardState] = useState<ServerCardState>({
    isEditing: false,
    selectedKey: "",
    keyValuePairs: {},
    currentValue: "",
    showValue: true,
  });

  const updateCardState = (updates: Partial<ServerCardState>) => {
    setCardState((prev) => ({
      ...prev,
      ...updates,
    }));
  };

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

  const editableParams = useMemo(() => {
    const params = [...envs];
    if (urlNeedsEdit) params.push("URL");
    return params;
  }, [envs, urlNeedsEdit]);

  useEffect(() => {
    if (
      cardState.isEditing &&
      !cardState.selectedKey &&
      editableParams.length > 0
    ) {
      updateCardState({ selectedKey: editableParams[0] });
    }
  }, [cardState.isEditing, editableParams, cardState.selectedKey]);

  const handleSaveParamsValue = () => {
    if (!cardState.selectedKey || !cardState.currentValue) return;
    updateCardState({
      keyValuePairs: {
        ...cardState.keyValuePairs,
        [cardState.selectedKey]: cardState.currentValue,
      },
      currentValue: "",
    });
  };

  const handleSaveEditableParams = () => {
    // saving the last pair even if the user didn't saved them manually
    if (!cardState.currentValue) {
      return;
    }

    const finalPairs = {
      ...cardState.keyValuePairs,
      [cardState.selectedKey]: cardState.currentValue,
    };

    const firstMissingKey = editableParams.find((key) => !finalPairs[key]);

    if (firstMissingKey) {
      // not all keys are filled
      handleSaveParamsValue(); // Save current valid input if any
      updateCardState({
        selectedKey: firstMissingKey,
        currentValue: "",
      });
      return; // Block the save
    }

    const [serverName] = Object.keys(server.config);
    const currentTargetServerData = server.config[serverName];

    const updatedTargetServerData = {
      ...currentTargetServerData,
      ...(currentTargetServerData.type === "stdio"
        ? { env: { ...currentTargetServerData.env, ...finalPairs } }
        : { url: finalPairs.URL }),
    };

    onAddServer(
      { [serverName]: updatedTargetServerData },
      server.displayName,
      false,
    );
    updateCardState({ isEditing: false });
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
              if (cardState.isEditing) {
                handleSaveEditableParams();
              } else if (needsEdit) {
                updateCardState({ isEditing: true });
              } else {
                onAddServer(server.config, server.displayName, false);
              }
            }}
          >
            {cardState.isEditing ? (
              <Check className="w-4 h-4 text-white" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
          </Button>
        )}
      </div>

      <div className="line-clamp-2 mb-auto text-sm font-normal text-primary">
        {server.description}
      </div>

      <div className="flex-1 flex flex-col gap-4">
        {/* Headers and cancel button */}
        {(!!envs?.length || urlNeedsEdit) && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-primary font-semibold">
              {urlNeedsEdit ? "PARAMETERS" : "ENVIRONMENT VARIABLES"}
            </div>
            {cardState.isEditing && (
              <X
                className="w-4 h-4 cursor-pointer text-[#7D7B98] hover:text-[#1D1B48]"
                onClick={() => {
                  updateCardState({
                    isEditing: false,
                    selectedKey: "",
                    currentValue: "",
                    keyValuePairs: {},
                  });
                }}
              />
            )}
          </div>
        )}
        {/* Params: Static and Edit mode */}
        {!cardState.isEditing ? (
          <div className="flex flex-wrap gap-2">
            {editableParams.map((key) => (
              <div
                key={key}
                className="font-semibold text-[#5147E4] px-1.5 py-0.5 rounded bg-[#EBE6FB] text-[10px]"
              >
                {key}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Clickable Parameters */}
            <div className="flex flex-wrap gap-2">
              {editableParams.map((key) => (
                <div
                  key={key}
                  onClick={() => {
                    if (key === cardState.selectedKey) return;
                    // Auto-save the current value for the previous key
                    handleSaveParamsValue();
                    // Switch to the new key and load its saved value (if any)
                    updateCardState({
                      selectedKey: key,
                      currentValue: cardState.keyValuePairs[key] || "",
                    });
                  }}
                  className={cn(
                    "font-semibold px-1.5 py-0.5 cursor-pointer rounded text-[10px]",
                    (
                      key === cardState.selectedKey
                        ? cardState.currentValue
                        : cardState.keyValuePairs[key]
                    )
                      ? "text-[#007E50] bg-[#D7F3E8]"
                      : "text-[#5147E4] bg-[#EBE6FB]",
                    cardState.selectedKey === key &&
                      (cardState.currentValue || cardState.keyValuePairs[key]
                        ? "ring-1 ring-[#007E50]"
                        : "ring-1 ring-[#5147E4]"),
                  )}
                >
                  {key}
                </div>
              ))}
            </div>
            {/* Input Rows (Key & Value) */}
            <div className="flex flex-col gap-3 mt-2">
              <div className="flex flex-wrap gap-x-4 gap-y-3 items-end">
                {/* Key Box */}

                <div className="flex-[2] min-w-[180px] flex gap-2 items-end">
                  <div className="flex-1 flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-[#1D1B48]">
                      Value
                    </span>
                    <div className="relative h-10">
                      <input
                        type={cardState.showValue ? "password" : "text"}
                        placeholder="Insert value..."
                        value={cardState.currentValue}
                        onChange={(e) =>
                          updateCardState({ currentValue: e.target.value })
                        }
                        className="w-full h-full pl-3 pr-10 bg-white border border-[#D8DCED] rounded-lg text-sm focus:outline-none focus:border-[#5147E4]"
                      />
                      <div
                        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-[#7D7B98]"
                        onClick={() =>
                          updateCardState({ showValue: !cardState.showValue })
                        }
                      >
                        {cardState.showValue ? (
                          <EyeOff size={16} />
                        ) : (
                          <Eye size={16} />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
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
        {/* <div className="text-sm text-muted-foreground">
          {server.tools || 0} Tools
        </div> */}
      </div>
    </div>
  );
};
