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
        let consumerConfig: AppConfig["permissions"]["consumers"][string];

        // Determine type based on available properties or _type field
        const hasAllow = "allow" in config && Array.isArray(config.allow);
        const hasBlock = "block" in config && Array.isArray(config.block);

        if (hasBlock && !hasAllow) {
          // Has block array but no allow array - default-allow behavior
          consumerConfig = {
            base: "allow",
            profiles: {
              block:
                "block" in config && Array.isArray(config.block)
                  ? config.block
                  : [],
            },
            consumerGroupKey: config.consumerGroupKey || "",
          };
        } else if (hasAllow && !hasBlock) {
          // Has allow array but no block array - default-block behavior
          consumerConfig = {
            base: "block",
            profiles: {
              allow:
                "allow" in config && Array.isArray(config.allow)
                  ? config.allow
                  : [],
            },
            consumerGroupKey: config.consumerGroupKey || "",
          };
        } else if (config._type === "default-allow") {
          // Explicit default-allow type
          consumerConfig = {
            base: "allow",
            profiles: {
              block:
                "block" in config && Array.isArray(config.block)
                  ? config.block
                  : [],
            },
            consumerGroupKey: config.consumerGroupKey || "",
          };
        } else {
          // Default to default-block behavior
          consumerConfig = {
            base: "block",
            profiles: {
              allow:
                "allow" in config && Array.isArray(config.allow)
                  ? config.allow
                  : [],
            },
            consumerGroupKey: config.consumerGroupKey || "",
          };
        }

        return [name, consumerConfig];
      },
    ),
  );

  // Determine default base permission
  let defaultBase: "allow" | "block";
  const defaultConfig = nextVersionConfig.permissions.default;

  const hasAllow =
    "allow" in defaultConfig && Array.isArray(defaultConfig.allow);
  const hasBlock =
    "block" in defaultConfig && Array.isArray(defaultConfig.block);

  if (hasBlock && !hasAllow) {
    defaultBase = "allow";
  } else if (hasAllow && !hasBlock) {
    defaultBase = "block";
  } else if (defaultConfig._type === "default-allow") {
    defaultBase = "allow";
  } else {
    defaultBase = "block";
  }

  return {
    base: defaultBase,
    consumers,
  };
}

function convertPermissionsToNextVersion(
  currentVersionConfig: AppConfig,
): NextVersionAppConfig["permissions"] {
  const defaultConsumer: NextVersionAppConfig["permissions"]["default"] =
    currentVersionConfig.permissions.base === "allow"
      ? { block: [] }
      : { allow: [] };
  const consumers = Object.fromEntries(
    Object.entries(currentVersionConfig.permissions.consumers).map(
      ([name, config]) => {
        let consumerConfig: NextVersionAppConfig["permissions"]["consumers"][string];

        if (config.base === "allow") {
          consumerConfig = {
            block: config.profiles.block || [],
            consumerGroupKey: config.consumerGroupKey,
          };
        } else {
          consumerConfig = {
            allow: config.profiles.allow || [],
            consumerGroupKey: config.consumerGroupKey,
          };
        }

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
