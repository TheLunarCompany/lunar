import { NextVersionAppConfig, AppConfig } from "@mcpx/shared-model";

function convertToolExtensionFromNextVersion(
  nextVersionConfig: NextVersionAppConfig,
): AppConfig["toolExtensions"] {
  return {
    services: Object.fromEntries(
      Object.entries(nextVersionConfig.toolExtensions.services).map(
        ([serviceName, serviceTools]) => [
          serviceName,
          Object.fromEntries(
            Object.entries(serviceTools).map(([toolName, toolConfig]) => [
              toolName,
              {
                childTools: toolConfig.childTools.map((childTool) => ({
                  name: childTool.name,
                  description: childTool.description,
                  overrideParams: Object.fromEntries(
                    Object.entries(childTool.overrideParams)
                      .map(([paramName, paramConfig]) => [
                        paramName,
                        paramConfig.value,
                      ])
                      .filter(([_, paramValue]) => paramValue !== undefined),
                  ),
                })),
              },
            ]),
          ),
        ],
      ),
    ),
  };
}

function convertToolExtensionToNextVersion(
  currentVersionConfig: AppConfig,
): NextVersionAppConfig["toolExtensions"] {
  return {
    services: Object.fromEntries(
      Object.entries(currentVersionConfig.toolExtensions.services).map(
        ([serviceName, serviceTools]) => [
          serviceName,
          Object.fromEntries(
            Object.entries(serviceTools).map(([toolName, toolConfig]) => [
              toolName,
              {
                childTools: toolConfig.childTools.map((childTool) => ({
                  name: childTool.name,
                  description: childTool.description,
                  overrideParams: Object.fromEntries(
                    Object.entries(childTool.overrideParams).map(
                      ([paramName, paramValue]) => [
                        paramName,
                        { value: paramValue },
                      ],
                    ),
                  ),
                })),
              },
            ]),
          ),
        ],
      ),
    ),
  };
}

function convertPermissionsFromNextVersion(
  nextVersionConfig: NextVersionAppConfig,
): AppConfig["permissions"] {
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
  return {
    base:
      nextVersionConfig.permissions.default._type === "default-allow"
        ? "allow"
        : "block",
    consumers,
  };
}

function convertPermissionsToNextVersion(
  currentVersionConfig: AppConfig,
): NextVersionAppConfig["permissions"] {
  const defaultConsumer: NextVersionAppConfig["permissions"]["default"] =
    currentVersionConfig.permissions.base === "allow"
      ? { _type: "default-allow", block: [] }
      : { _type: "default-block", allow: [] };
  const consumers = Object.fromEntries(
    Object.entries(currentVersionConfig.permissions.consumers).map(
      ([name, config]) => {
        const consumerConfig: NextVersionAppConfig["permissions"]["consumers"][string] =
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

        return [name, consumerConfig];
      },
    ),
  );
  return { default: defaultConsumer, consumers };
}

export function convertToCurrentVersionConfig(
  nextVersionConfig: NextVersionAppConfig,
): AppConfig {
  const permissions = convertPermissionsFromNextVersion(nextVersionConfig);
  const toolExtensions = convertToolExtensionFromNextVersion(nextVersionConfig);

  return {
    ...nextVersionConfig,
    permissions,
    toolExtensions,
  };
}
export function convertToNextVersionConfig(
  currentVersion: AppConfig,
): NextVersionAppConfig {
  const newToolExtensions = convertToolExtensionToNextVersion(currentVersion);
  const newPermissions = convertPermissionsToNextVersion(currentVersion);

  return {
    ...currentVersion,
    permissions: newPermissions,
    toolExtensions: newToolExtensions,
  };
}
