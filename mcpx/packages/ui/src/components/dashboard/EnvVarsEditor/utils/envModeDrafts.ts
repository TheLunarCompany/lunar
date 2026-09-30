import {
  EnvVarMode,
  getMode,
  type EnvValue,
} from "@mcpx/toolkit-ui/src/utils/env-vars-utils";

export type EnvModeDrafts = Record<EnvVarMode, EnvValue>;

const EMPTY_DRAFTS: EnvModeDrafts = {
  literal: "",
  fromEnv: { fromEnv: "" },
  fromSecret: { fromSecret: "" },
};

export function createEnvModeDrafts(value: EnvValue): EnvModeDrafts {
  return syncDraftsWithValue(EMPTY_DRAFTS, value);
}

export function syncDraftsWithValue(
  drafts: EnvModeDrafts,
  value: EnvValue,
): EnvModeDrafts {
  return {
    ...drafts,
    [getMode(value)]: value,
  };
}

export function getValueForMode(
  drafts: EnvModeDrafts,
  mode: EnvVarMode,
): EnvValue {
  return drafts[mode];
}
