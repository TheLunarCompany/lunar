import { NextVersionAppConfig, AppConfig } from "@mcpx/shared-model";
import { Config } from "../model/config/config.js";
import { ConsumerConfig } from "../model/config/permissions.js";

export function convertToCurrentVersionConfig(
  nextVersionConfig: NextVersionAppConfig,
): AppConfig {
  const consumers = Object.fromEntries(
    Object.entries(nextVersionConfig.permissions.consumers).map(
      ([name, config]) => {
        const consumerConfig: AppConfig["permissions"]["consumers"][string] =
          config._type === "default-allow"
            ? {
                base: "allow",
                profiles: { block: config.block || [] },
                consumerGroupKey: config.consumerGroupKey || "",
              }
            : {
                base: "block",
                profiles: { allow: config.allow || [] },
                consumerGroupKey: config.consumerGroupKey || "",
              };
        return [name, consumerConfig];
      },
    ),
  );
  const permissions: AppConfig["permissions"] = {
    base:
      nextVersionConfig.permissions.default._type === "default-allow"
        ? "allow"
        : "block",
    consumers,
  };
  return {
    ...nextVersionConfig,
    permissions,
  };
}
export function convertToNextVersionConfig(
  currentVersion: AppConfig,
): NextVersionAppConfig {
  const oldPermissions = currentVersion.permissions;
  const defaultConsumer: ConsumerConfig =
    oldPermissions.base === "allow"
      ? { _type: "default-allow", block: [] }
      : { _type: "default-block", allow: [] };
  const consumers: Record<string, ConsumerConfig> = Object.entries(
    currentVersion.permissions.consumers,
  ).reduce<Record<string, ConsumerConfig>>((acc, [name, config]) => {
    const consumerConfig: ConsumerConfig =
      config.base === "allow"
        ? {
            _type: "default-allow",
            block: config.profiles.block || [],
            consumerGroupKey: config.consumerGroupKey,
          }
        : {
            _type: "default-block",
            allow: config.profiles.allow || [],
            consumerGroupKey: config.consumerGroupKey,
          };

    acc[name] = consumerConfig;
    return acc;
  }, {});

  const newPermissions: Config["permissions"] = {
    default: defaultConsumer,
    consumers,
  };
  return {
    ...currentVersion,
    permissions: newPermissions,
  };
}
