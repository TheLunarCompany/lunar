import type { AppConfig, TargetServer } from "@mcpx/shared-model";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

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
type CurrentServerPrompt = NonNullable<
  TargetServer["prompts"] | TargetServer["originalPrompts"]
>[number];
type MaterializedServerPrompt = NonNullable<TargetServer["prompts"]>[number];

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

function getOriginalPrompts(server: TargetServer): CurrentServerPrompt[] {
  return server.originalPrompts ?? [];
}

function getServerPrompts(server: TargetServer): MaterializedServerPrompt[] {
  return server.prompts ?? [];
}

function getPromptDescription(
  description: CurrentServerPrompt["description"],
): string {
  return typeof description === "string" ? description : "";
}

function promptArgumentsToInputSchema(
  args: CurrentServerPrompt["arguments"] = [],
): Tool["inputSchema"] {
  return {
    type: "object",
    properties: Object.fromEntries(
      args.map((arg) => [
        arg.name,
        {
          type: "string",
          ...(arg.description ? { description: arg.description } : {}),
        },
      ]),
    ),
    required: args.filter((arg) => arg.required).map((arg) => arg.name),
  };
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
      const serverPrompts = getServerPrompts(server);
      const originalPrompts = getOriginalPrompts(server);
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
      const serverPromptsByName = new Map(
        serverPrompts
          .filter((prompt) => prompt?.name)
          .map((prompt) => [prompt.name, prompt]),
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
      const promptDefinitions =
        originalPrompts.length > 0 ? originalPrompts : serverPrompts;
      const originalPromptItems = promptDefinitions
        .filter((prompt) => prompt?.name)
        .map((prompt): CapabilityItem => {
          const materializedPrompt = serverPromptsByName.get(prompt.name);

          return {
            id: buildCapabilitySelectionKey(server.name, prompt.name),
            kind: "prompt",
            name: prompt.name,
            description:
              getPromptDescription(materializedPrompt?.description) ||
              getPromptDescription(prompt.description),
            providerName: server.name,
            inputSchema: promptArgumentsToInputSchema(prompt.arguments),
            messages: materializedPrompt?.messages,
          };
        });

      return {
        name: server.name,
        state: server.state,
        icon: server.icon,
        items: [
          ...customItems.sort((a, b) => compareNames(a.name, b.name)),
          ...originalPromptItems.sort((a, b) => compareNames(a.name, b.name)),
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
