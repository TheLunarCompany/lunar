import type { AppConfig, TargetServer } from "@mcpx/shared-model";

import type {
  CapabilityGroup,
  CapabilityItem,
  CapabilityProvider,
} from "./types";
import { buildCapabilitySelectionKey } from "./capability-selection-key";

type ToolExtensionsServices = AppConfig["toolExtensions"]["services"];
type ToolGroups = AppConfig["toolGroups"];
type CurrentServerTool =
  | TargetServer["tools"][number]
  | TargetServer["originalTools"][number];

function compareNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function getToolDescription(
  description: CurrentServerTool["description"],
): string {
  return typeof description === "string" ? description : "";
}

function getServerTools(server: TargetServer): CurrentServerTool[] {
  return server.tools ?? [];
}

function getOriginalTools(server: TargetServer): CurrentServerTool[] {
  return server.originalTools ?? [];
}

export function buildCapabilityProvidersFromCurrentTools(args: {
  targetServers?: TargetServer[];
  toolExtensionsServices?: ToolExtensionsServices;
}): CapabilityProvider[] {
  const targetServers = args.targetServers ?? [];

  return targetServers
    .map((server) => {
      const serverTools = getServerTools(server);
      const originalTools = getOriginalTools(server);
      const originalToolsByName = new Map(
        originalTools
          .filter((tool) => tool?.name)
          .map((tool) => [tool.name, tool]),
      );
      const serverToolsByName = new Map(
        serverTools
          .filter((tool) => tool?.name)
          .map((tool) => [tool.name, tool]),
      );

      const customItems = Object.entries(
        args.toolExtensionsServices?.[server.name] ?? {},
      ).flatMap(([originalToolName, extension]) => {
        const originalTool = originalToolsByName.get(originalToolName);

        return (extension.childTools ?? [])
          .filter((tool) => tool?.name)
          .map((tool): CapabilityItem => {
            const materializedTool = serverToolsByName.get(tool.name);

            return {
              id: buildCapabilitySelectionKey(server.name, tool.name),
              kind: "tool",
              name: tool.name,
              description:
                getToolDescription(materializedTool?.description) ||
                (typeof tool.description?.text === "string"
                  ? tool.description.text
                  : "") ||
                getToolDescription(originalTool?.description),
              providerName: server.name,
              isCustom: true,
              originalToolName,
              ...(tool.overrideParams &&
              Object.keys(tool.overrideParams).length > 0
                ? { overrideParams: tool.overrideParams }
                : {}),
              inputSchema:
                materializedTool?.inputSchema ?? originalTool?.inputSchema,
              annotations:
                materializedTool?.annotations ?? originalTool?.annotations,
            };
          });
      });

      const originalItems = originalTools
        .filter((tool) => tool?.name)
        .map(
          (tool): CapabilityItem => ({
            id: buildCapabilitySelectionKey(server.name, tool.name),
            kind: "tool",
            name: tool.name,
            description: getToolDescription(tool.description),
            providerName: server.name,
            inputSchema: tool.inputSchema,
            annotations: tool.annotations,
          }),
        );

      return {
        name: server.name,
        state: server.state,
        icon: server.icon,
        items: [
          ...customItems.sort((a, b) => compareNames(a.name, b.name)),
          ...originalItems.sort((a, b) => compareNames(a.name, b.name)),
        ],
      };
    })
    .filter((provider) => provider.items.length > 0)
    .sort((a, b) => compareNames(a.name, b.name));
}

export function buildCapabilityGroupsFromCurrentToolGroups(args: {
  toolGroups?: ToolGroups;
}): CapabilityGroup[] {
  return (args.toolGroups ?? []).map((group, index) => ({
    id: `tool_group_${index}`,
    name: group.name,
    description: group.description ?? "",
    services: group.services,
    providers: Object.entries(group.services).map(([providerName, items]) => {
      const itemNames = Array.isArray(items) ? items : [];
      const isWildcard = items === "*";

      return {
        providerName,
        itemCount: itemNames.length,
        itemNames,
        selectionKeys: itemNames.map((itemName) =>
          buildCapabilitySelectionKey(providerName, itemName),
        ),
        ...(isWildcard ? { isWildcard: true } : {}),
      };
    }),
  }));
}
