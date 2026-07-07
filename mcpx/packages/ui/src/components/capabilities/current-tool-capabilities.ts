import type { AppConfig, TargetServer } from "@mcpx/shared-model";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

import type {
  CapabilityGroup,
  CapabilityItem,
  CapabilityKind,
  CapabilityProvider,
} from "./types";
import { buildCapabilitySelectionKey } from "./capability-selection-key";

type ToolExtensionsServices = AppConfig["toolExtensions"]["services"];
type ToolGroups = AppConfig["toolGroups"];
type CurrentServerTool =
  | TargetServer["tools"][number]
  | TargetServer["originalTools"][number];
// Live tools carry runtime data (estimatedTokens); raw originalTools don't.
type MaterializedServerTool = TargetServer["tools"][number];
type CurrentServerPrompt = NonNullable<
  TargetServer["prompts"] | TargetServer["originalPrompts"]
>[number];
type MaterializedServerPrompt = NonNullable<TargetServer["prompts"]>[number];

function compareNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

// Use the first icon's src; theme/size variants are ignored.
function firstIconSrc(icons: unknown): string | undefined {
  if (!Array.isArray(icons)) return undefined;
  const first = icons[0] as { src?: unknown } | undefined;
  return typeof first?.src === "string" ? first.src : undefined;
}

function getToolDescription(
  description: CurrentServerTool["description"],
): string {
  return typeof description === "string" ? description : "";
}

function getServerTools(server: TargetServer): MaterializedServerTool[] {
  return server.tools ?? [];
}

function getOriginalTools(server: TargetServer): Tool[] {
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
              estimatedTokens: materializedTool?.estimatedTokens,
              iconUrl: firstIconSrc(originalTool?.icons),
            };
          });
      });
      const customItemNames = new Set(customItems.map((item) => item.name));

      const originalItems = originalTools
        .filter((tool) => tool?.name && !customItemNames.has(tool.name))
        .map((tool): CapabilityItem => {
          const materializedTool = serverToolsByName.get(tool.name);

          return {
            id: buildCapabilitySelectionKey(server.name, tool.name),
            kind: "tool",
            name: tool.name,
            description: getToolDescription(tool.description),
            providerName: server.name,
            inputSchema: tool.inputSchema,
            annotations: tool.annotations,
            estimatedTokens: materializedTool?.estimatedTokens,
            iconUrl: firstIconSrc(tool.icons),
          };
        });
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
            iconUrl: firstIconSrc((prompt as { icons?: unknown }).icons),
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

// Kind comes from the live providers; config `services` only lists names.
// Unknown names fall back to "tool".
function buildProviderKindIndex(providers: CapabilityProvider[]): Map<
  string,
  {
    kindByName: Map<string, CapabilityKind>;
    toolCount: number;
    promptCount: number;
  }
> {
  return new Map(
    providers.map((provider) => {
      const kindByName = new Map<string, CapabilityKind>();
      let toolCount = 0;
      let promptCount = 0;

      for (const item of provider.items) {
        kindByName.set(item.name, item.kind);
        if (item.kind === "prompt") {
          promptCount += 1;
        } else {
          toolCount += 1;
        }
      }

      return [provider.name, { kindByName, toolCount, promptCount }];
    }),
  );
}

export function buildCapabilityGroupsFromCurrentToolGroups(args: {
  toolGroups?: ToolGroups;
  providers?: CapabilityProvider[];
}): CapabilityGroup[] {
  const providerKindIndex = buildProviderKindIndex(args.providers ?? []);

  return (args.toolGroups ?? []).map((group, index) => ({
    id: `tool_group_${index}`,
    name: group.name,
    description: group.description ?? "",
    services: group.services,
    providers: Object.entries(group.services).map(([providerName, items]) => {
      const itemNames = Array.isArray(items) ? items : [];
      const isWildcard = items === "*";
      const kinds = providerKindIndex.get(providerName);

      let toolCount: number;
      let promptCount: number;
      if (isWildcard) {
        toolCount = kinds?.toolCount ?? 0;
        promptCount = kinds?.promptCount ?? 0;
      } else {
        promptCount = itemNames.filter(
          (itemName) => kinds?.kindByName.get(itemName) === "prompt",
        ).length;
        toolCount = itemNames.length - promptCount;
      }

      return {
        providerName,
        itemCount: itemNames.length,
        toolCount,
        promptCount,
        itemNames,
        selectionKeys: itemNames.map((itemName) =>
          buildCapabilitySelectionKey(providerName, itemName),
        ),
        ...(isWildcard ? { isWildcard: true } : {}),
      };
    }),
  }));
}
