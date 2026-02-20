import { useDomainIcon } from "@/hooks/useDomainIcon";
import McpIcon from "./SystemConnectivity/nodes/Mcpx_Icon.svg?react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { useState, useMemo, useEffect } from "react";
import { Check, X, Plus } from "lucide-react";
import GitHubLogo from "./icons/GitHubLogo.svg?react";
import GitHubLogoSolid from "./icons/GitHubLogoSolid.svg?react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  getServerStatusBackgroundColor,
  getServerStatusText,
  getServerStatusTextColor,
} from "./helpers";
import { getMcpColorByName } from "./constants";
import { isRemoteUrlValid } from "@mcpx/toolkit-ui/src/utils/mcpJson";
import {
  CatalogMCPServerConfigByNameItem,
  isEnvRequirement,
} from "@mcpx/toolkit-ui/src/utils/server-helpers";
import { CatalogConfig, EnvValue } from "@mcpx/shared-model";
import {
  EnvVarMode,
  isFromEnv,
  isLiteral,
  getMode,
  isRequirementSatisfied,
  isEnvValuesEqual,
  EnvVarState,
} from "./EnvVarsEditor/types";
import { FixedInput, FromEnvInput, LiteralInput } from "./EnvVarsEditor/inputs";
import { useToast } from "@/components/ui/use-toast";

interface ServerCardState {
  isEditing: boolean;
  selectedKey: string;
  envVarStates: Record<string, EnvVarState>;
  showValue: boolean;
  isReadyToAdd: boolean;
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

function initializeEnvVarStates(
  config: CatalogConfig,
): Record<string, EnvVarState> {
  const envVarStates: Record<string, EnvVarState> = {};
  if (config.type === "stdio" && config.env) {
    for (const [key, value] of Object.entries(config.env)) {
      if (isEnvRequirement(value)) {
        envVarStates[key] = {
          key: key,
          currentValue: "",
          savedValue: undefined,
          prefilled: value.prefilled,
          requirement: value,
          isUserModified: false,
        };
      }
    }
  }
  // handle url as parameter case
  if (config.type !== "stdio" && isRemoteUrlNeedEdit(config)) {
    const urlValue = config.url;
    envVarStates["URL"] = {
      key: "URL",
      currentValue: "",
      savedValue: undefined,
      isUserModified: false,
      prefilled: urlValue,
      requirement: {
        kind: "required",
        prefilled: urlValue,
      },
    };
  }
  return envVarStates;
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

  const [cardState, setCardState] = useState<ServerCardState>({
    isEditing: false,
    selectedKey: "",
    envVarStates: {},
    showValue: true,
    isReadyToAdd: false,
  });

  const currentEnvVarState = cardState.envVarStates[cardState.selectedKey];
  const currentMode = getMode(currentEnvVarState?.currentValue ?? "");
  const { toast } = useToast();

  const updateCardState = (updates: Partial<ServerCardState>) => {
    setCardState((prev) => ({
      ...prev,
      ...updates,
    }));
  };

  const handleModeChange = (newMode: EnvVarMode) => {
    if (newMode === "fromEnv") {
      handleValueChange({ fromEnv: "" });
    } else {
      handleValueChange("");
    }
  };

  const badges = useMemo(() => {
    const config = server.config[server.name];

    if (config.type === "stdio") {
      const command = config.command;
      return ["Local", command];
    }
    return ["Remote"];
  }, [server]);

  const envVarStates = useMemo(
    () => initializeEnvVarStates(server.config[server.name]),
    [server.config, server.name],
  );
  const envVarKeys = useMemo(() => Object.keys(envVarStates), [envVarStates]);

  const urlNeedsEdit = useMemo(
    () => isRemoteUrlNeedEdit(server.config[server.name]),
    [server.config, server.name],
  );

  const needsEdit = envVarKeys.length > 0; // if no env vars or url param that needs editing, no need to edit
  /*   const editableParams = useMemo(() => {
    const params = [...envVars];
    if (urlNeedsEdit) params.push("URL");
    return params;
  }, [envVars, urlNeedsEdit]); */

  useEffect(() => {
    updateCardState({
      envVarStates: envVarStates,
    });
  }, [envVarStates]);

  useEffect(() => {
    if (
      cardState.isEditing &&
      !cardState.selectedKey &&
      envVarKeys.length > 0
    ) {
      const firstKey = envVarKeys[0];
      const firstEnvVarState = cardState.envVarStates[firstKey];
      const valueToShow =
        firstEnvVarState.savedValue ?? firstEnvVarState.prefilled ?? "";
      updateCardState({
        selectedKey: firstKey,
        envVarStates: {
          ...cardState.envVarStates,
          [firstKey]: { ...firstEnvVarState, currentValue: valueToShow },
        },
      });
    }
  }, [
    cardState.isEditing,
    envVarKeys,
    cardState.selectedKey,
    cardState.envVarStates,
  ]);

  const handleSaveCurrentEnvVar = (
    currentState: ServerCardState,
  ): Record<string, EnvVarState> | undefined => {
    if (!currentState.selectedKey) return undefined;

    const currentEnvVarState =
      currentState.envVarStates[currentState.selectedKey];
    // not saving if the value isn't valid
    const validation = isRequirementSatisfied(
      currentEnvVarState.requirement,
      currentEnvVarState.currentValue,
    );
    if (!validation.satisfied) {
      toast({
        title: `Saving ${currentState.selectedKey} failed`,
        description: validation.reason,
        variant: "destructive",
      });
      return undefined;
    }

    // saving valid current value
    return {
      ...currentState.envVarStates,
      [currentState.selectedKey]: {
        ...currentEnvVarState,
        savedValue: currentEnvVarState.currentValue,
      },
    };
  };

  function handleClickEnvVar(envVarKey: string): void {
    if (envVarKey === cardState.selectedKey) return; // do nothing if already selected

    const updatedEnvVarStates =
      handleSaveCurrentEnvVar(cardState) ?? cardState.envVarStates; // save the current .selectedKey before switching

    const newEnvVarState = updatedEnvVarStates[envVarKey];
    const valueToShow =
      newEnvVarState.savedValue !== undefined
        ? newEnvVarState.savedValue
        : (newEnvVarState.prefilled ?? ""); // show the save value if there is one, if no - try the prefilled and if not - ""

    // switch to the new var
    updateCardState({
      selectedKey: envVarKey,
      envVarStates: {
        ...updatedEnvVarStates,
        [envVarKey]: {
          ...newEnvVarState,
          currentValue: valueToShow,
        },
      },
    });
  }

  function handleValueChange(newValue: EnvValue): void {
    if (!cardState.selectedKey) return;

    const currentEnvVarState = cardState.envVarStates[cardState.selectedKey];
    // check if the new value is different from the prefilled one or from an empty string
    const isModified = !isEnvValuesEqual(
      newValue,
      currentEnvVarState.prefilled ?? "",
    );

    updateCardState({
      envVarStates: {
        ...cardState.envVarStates,
        [cardState.selectedKey]: {
          ...currentEnvVarState,
          currentValue: newValue,
          isUserModified: isModified,
        },
      },
    });
  }

  function handleRestorePrefilled(): void {
    if (!cardState.selectedKey) return;

    const currentEnvVarState = cardState.envVarStates[cardState.selectedKey];

    if (!currentEnvVarState.prefilled) return; // nothing to restore to, save guard.

    updateCardState({
      envVarStates: {
        ...cardState.envVarStates,
        [cardState.selectedKey]: {
          ...currentEnvVarState,
          currentValue: currentEnvVarState.prefilled,
          isUserModified: false, // restoring like the user didn't change nothing
        },
      },
    });
  }

  const handleSubmitEnvVars = () => {
    // updating the last value even if the user didn't saved it manually
    const updatedEnvVarStates = handleSaveCurrentEnvVar(cardState);
    if (!updatedEnvVarStates) {
      return;
    }

    // check that all of the saved values are ok, and if no value was saved - check the prefilled (and if undefined, check if an empty string is ok)
    const allValid = Object.values(updatedEnvVarStates).every(
      (state) =>
        isRequirementSatisfied(
          state.requirement,
          state.savedValue !== undefined
            ? state.savedValue
            : (state.prefilled ?? ""),
        ).satisfied,
    );

    if (!allValid) {
      // find the first key that didn't satisfied the requirement
      const firstInvalidVar = Object.values(updatedEnvVarStates).find(
        (state) =>
          !isRequirementSatisfied(
            state.requirement,
            state.savedValue !== undefined
              ? state.savedValue
              : (state.prefilled ?? ""),
          ).satisfied,
      );

      // if a key was found, (should be found) then block the save the show the user
      if (firstInvalidVar) {
        const valueToShow =
          firstInvalidVar.savedValue !== undefined
            ? firstInvalidVar.savedValue
            : (firstInvalidVar.prefilled ?? "");
        updateCardState({
          selectedKey: firstInvalidVar.key,
          envVarStates: {
            ...updatedEnvVarStates,
            [firstInvalidVar.key]: {
              ...updatedEnvVarStates[firstInvalidVar.key],
              currentValue: valueToShow,
            },
          },
        });
      }
      return; // block submission
    }
    // mark server as ready for adding
    updateCardState({
      isEditing: false,
      isReadyToAdd: true,
      envVarStates: updatedEnvVarStates,
    });
  };

  const handleAddReadyServer = () => {
    const finalEnv: Record<string, EnvValue> = {};
    for (const [key, state] of Object.entries(cardState.envVarStates)) {
      const valueToSave =
        state.savedValue !== undefined
          ? state.savedValue
          : (state.prefilled ?? "");

      // if the requirement is optional - the valueToSave can be "" or undefined, let's replaced it with an actual null.
      if (
        state.requirement.kind === "optional" &&
        (valueToSave === "" || valueToSave === undefined)
      ) {
        finalEnv[key] = null;
      } else if (state.requirement.kind === "fixed") {
        finalEnv[key] = state.requirement.prefilled; // safeguard - we save the original prefilled value for fixed env vars.
      } else {
        finalEnv[key] = valueToSave;
      }
    }

    const currentTargetServerData = server.config[server.name];

    const updatedTargetServerData = {
      ...currentTargetServerData,
      ...(currentTargetServerData.type === "stdio"
        ? { env: finalEnv }
        : { url: finalEnv.URL }),
    };

    onAddServer(
      { [server.name]: updatedTargetServerData },
      server.displayName,
      false,
    );
  };

  function handleCancel(): void {
    const freshStates = initializeEnvVarStates(server.config[server.name]);

    updateCardState({
      isEditing: false,
      selectedKey: "",
      envVarStates: freshStates,
      isReadyToAdd: false,
    });
  }

  function getEnvVarTagColor(
    state: EnvVarState,
    isSelected: boolean,
  ): { base: string; ring: string } {
    const { requirement, savedValue, currentValue, prefilled } = state;

    const isFixed = requirement.kind === "fixed"; // if an env vars is fixed, will show in gray only.
    const valueToValidate = isSelected
      ? currentValue
      : savedValue !== undefined
        ? savedValue
        : (prefilled ?? "");
    const isValid = isRequirementSatisfied(
      requirement,
      valueToValidate,
    ).satisfied;

    let baseColor: string;
    if (isFixed) {
      baseColor = "text-gray-600 bg-gray-200";
    } else if (isValid) {
      baseColor = "text-[#007E50] bg-[#D7F3E8]";
    } else {
      baseColor = "text-[#5147E4] bg-[#EBE6FB]";
    }

    let ringColor: string;

    if (isSelected) {
      if (isFixed) {
        ringColor = "ring-1 ring-gray-400";
      } else if (isValid) {
        ringColor = "ring-1 ring-[#007E50]";
      } else {
        ringColor = "ring-1 ring-[#5147E4]";
      }
    } else {
      ringColor = "";
    }
    return { base: baseColor, ring: ringColor };
  }

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
                handleSubmitEnvVars();
              } else if (cardState.isReadyToAdd) {
                handleAddReadyServer();
              } else if (needsEdit) {
                const firstKey = envVarKeys[0];
                const firstEnvVarState = cardState.envVarStates[firstKey];
                const valueToShow =
                  firstEnvVarState.savedValue ??
                  firstEnvVarState.prefilled ??
                  "";

                updateCardState({
                  isEditing: true,
                  selectedKey: firstKey,
                  envVarStates: {
                    ...cardState.envVarStates,
                    [firstKey]: {
                      ...firstEnvVarState,
                      currentValue: valueToShow,
                    },
                  },
                });
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

      <div className="flex-1 flex flex-col gap-2">
        {/* Headers and cancel button */}
        {envVarKeys.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-primary font-semibold">
              {urlNeedsEdit ? "PARAMETERS" : "ENVIRONMENT VARIABLES"}
            </div>
            {cardState.isEditing && (
              <X
                className="w-4 h-4 cursor-pointer text-[#7D7B98] hover:text-[#1D1B48]"
                onClick={() => handleCancel()}
              />
            )}
          </div>
        )}
        {/* Params: Static and Edit mode */}
        {!cardState.isEditing ? (
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
        ) : (
          <div className="flex flex-col gap-3">
            {/* Clickable Parameters */}
            <div className="flex flex-wrap gap-2">
              {envVarKeys.map((key) => {
                const state = cardState.envVarStates[key];
                const isSelected = cardState.selectedKey === key;
                const colors = getEnvVarTagColor(state, isSelected);

                return (
                  <div
                    key={key}
                    onClick={() => handleClickEnvVar(key)}
                    className={cn(
                      "font-semibold px-1.5 py-0.5 cursor-pointer rounded text-[10px]",
                      colors.base,
                      colors.ring,
                    )}
                  >
                    {key}
                  </div>
                );
              })}
            </div>
            {/* Input Rows (Key & Value) */}
            <div className="flex flex-col gap-3 mt-2">
              <div className="flex flex-wrap gap-x-4 gap-y-3 items-end">
                <div className="flex-[1] min-w-[100px] flex gap-2 items-end">
                  {/* Mode Selector */}
                  <div className="flex-1 flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-[#1D1B48]">
                      Mode
                    </span>
                    <Select
                      value={currentMode}
                      onValueChange={(v) => handleModeChange(v as EnvVarMode)}
                      disabled={
                        currentEnvVarState?.requirement.kind === "fixed"
                      } // no selector when fixed.
                    >
                      <SelectTrigger className="h-10 text-sm bg-white border border-[#D8DCED] rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="literal">Value</SelectItem>
                        <SelectItem value="fromEnv">From Env</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Values Inputs */}
                <div className="flex-[2] min-w-[180px] flex gap-2 items-end">
                  <div className="flex-1 flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-[#1D1B48]">
                      {currentMode === "fromEnv"
                        ? "Environment Variable"
                        : "Value"}
                    </span>
                    <div className="relative h-10">
                      {(() => {
                        const requirement = currentEnvVarState.requirement;

                        // CASE fixed
                        if (requirement?.kind === "fixed") {
                          // Convert EnvValue to display string for FixedInput
                          const displayValue = isFromEnv(
                            currentEnvVarState.currentValue,
                          )
                            ? currentEnvVarState.currentValue.fromEnv
                            : currentEnvVarState.currentValue === null
                              ? "empty"
                              : currentEnvVarState.currentValue;

                          return <FixedInput value={displayValue} />;
                        }

                        // Value can be changed, now for Optional/Required cases, based on value type
                        if (currentMode === "fromEnv") {
                          return (
                            <FromEnvInput
                              value={
                                isFromEnv(currentEnvVarState.currentValue)
                                  ? currentEnvVarState.currentValue.fromEnv
                                  : ""
                              }
                              onChange={(envVarName) =>
                                handleValueChange({ fromEnv: envVarName })
                              }
                              isMissing={false}
                              disabled={false}
                              isRequired={requirement.kind === "required"}
                              hasPrefilled={!!currentEnvVarState.prefilled}
                              isModified={currentEnvVarState.isUserModified}
                              onReset={() => handleRestorePrefilled()}
                            />
                          );
                        }

                        return (
                          <LiteralInput
                            value={
                              isLiteral(currentEnvVarState.currentValue)
                                ? currentEnvVarState.currentValue
                                : ""
                            }
                            onChange={(value) => handleValueChange(value)}
                            onLeaveEmpty={(checked) =>
                              handleValueChange(checked ? null : "")
                            }
                            isNull={currentEnvVarState.currentValue === null}
                            disabled={false}
                            envKey={cardState.selectedKey}
                            isRequired={requirement.kind === "required"}
                            hasPrefilled={!!currentEnvVarState.prefilled}
                            isModified={currentEnvVarState.isUserModified}
                            onReset={() => handleRestorePrefilled()}
                          />
                        );
                      })()}
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
      </div>
    </div>
  );
};
