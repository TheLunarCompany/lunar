import { indexBy } from "@mcpx/toolkit-core/data";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ConfigManager } from "../config.js";
import { ServiceToolExtensions, ToolExtension } from "../model.js";

type ListToolsResponse = Awaited<ReturnType<Client["listTools"]>>;

export interface OriginalClientI {
  close(): Promise<void>;
  listTools(): Promise<ListToolsResponse>;
  callTool(props: {
    name: string;
    arguments: Record<string, unknown> | undefined;
  }): ReturnType<Client["callTool"]>;
}

export class ExtendedClientBuilder {
  constructor(private configManager: ConfigManager) {}

  build(props: { name: string; originalClient: Client }): ExtendedClient {
    const { name, originalClient } = props;
    const config = this.configManager.getConfig();
    const serviceToolExtensions = config.toolExtensions.services[name] || {};
    return new ExtendedClient(originalClient, serviceToolExtensions);
  }
}

export class ExtendedClient {
  private cachedListToolsResponse?: ListToolsResponse;
  private cachedExtendedTools?: Record<string, ExtendedTool>;

  constructor(
    private originalClient: OriginalClientI,
    private serviceToolExtensions: ServiceToolExtensions,
  ) {}

  async close(): Promise<void> {
    return await this.originalClient.close();
  }

  async listTools(): Promise<ReturnType<Client["listTools"]>> {
    // Obtain tools and extend them
    const originalResponse = await this.originalClient.listTools();
    const enrichedTools = originalResponse.tools.flatMap((tool) =>
      this.extendTool(tool),
    );

    // Persist
    this.cachedListToolsResponse = originalResponse;
    this.cachedExtendedTools = indexBy(
      enrichedTools,
      (tool) => tool.extendedName,
    );

    // Serve from state
    return this.extendedListToolsResponse();
  }

  async callTool(props: {
    name: string;
    arguments: Record<string, unknown> | undefined;
  }): Promise<ReturnType<Client["callTool"]>> {
    if (!this.cachedListToolsResponse || !this.cachedExtendedTools) {
      await this.listTools();
    }
    const extendedTool = this.cachedExtendedTools?.[props.name];
    if (!extendedTool) {
      return await this.originalClient.callTool(props);
    }
    const modifiedArguments = extendedTool.buildArguments(props.arguments);

    // Call the original tool with modified arguments
    return await this.originalClient.callTool({
      name: extendedTool.originalName,
      arguments: modifiedArguments,
    });
  }

  private extendedListToolsResponse(): ListToolsResponse {
    const allTools = [
      ...(this.cachedListToolsResponse?.tools || []),
      ...Object.values(this.cachedExtendedTools || {}).map((tool) =>
        tool.asTool(),
      ),
    ];
    return {
      ...this.cachedListToolsResponse,
      tools: allTools,
    };
  }

  private extendTool(originalTool: Tool): ExtendedTool[] {
    const extensionConfig = this.serviceToolExtensions[originalTool.name];
    if (!extensionConfig) {
      return [];
    }
    return extensionConfig.childTools.map((config) => {
      return new ExtendedTool(originalTool, config);
    });
  }
}

class ExtendedTool {
  // undefined represents that the value has not been computed yet
  // null represents that the value is not present
  _description: string | null | undefined = undefined;
  _inputSchema: Tool["inputSchema"] | undefined = undefined;

  constructor(
    private original: Tool,
    private extension: ToolExtension,
  ) {}

  // To be used upon `listTools` invocations.
  // Returns a Tool object with the extended properties, overriding the original.
  asTool(): Tool {
    return {
      name: this.extendedName,
      inputSchema: this.inputSchema,
      description: this.description || undefined,
    };
  }

  // To be used upon `callTool` invocations.
  // Returns a merge of the original tool arguments and the extension override parameters.
  buildArguments(
    original: Record<string, unknown> | undefined,
  ): Record<string, unknown> {
    return { ...original, ...this.extension.overrideParams };
  }

  get originalName(): string {
    return this.original.name;
  }

  get extendedName(): string {
    return this.extension.name;
  }

  // Returns the modified description
  get description(): string | null {
    // memoization
    if (this._description !== undefined) {
      return this._description;
    }
    const description = this.buildDescription();
    this._description = description;
    return this._description;
  }

  // Returns the modified inputSchema
  get inputSchema(): Tool["inputSchema"] {
    // memoization
    if (this._inputSchema !== undefined) {
      return this._inputSchema;
    }
    const inputSchema = this.buildInputSchema();
    this._inputSchema = inputSchema;
    return this._inputSchema;
  }

  private buildDescription(): string | null {
    if (!this.extension.description) {
      return this.original.description || null;
    }
    if (!this.original.description) {
      return this.extension.description.text;
    }
    switch (this.extension.description.action) {
      case "append":
        return ExtendedTool.appendSentence(
          this.original.description,
          this.extension.description.text,
        );
      case "rewrite":
        return this.extension.description.text;
    }
  }

  private buildInputSchema(): Tool["inputSchema"] {
    const originalProperties = this.original.inputSchema.properties;
    if (!originalProperties) {
      return this.original.inputSchema;
    }

    const modifiedProperties = Object.entries(originalProperties).reduce<
      Record<string, unknown>
    >((acc, [originalPropertyName, rawOriginalProperty]) => {
      const extendedProperty =
        this.extension.overrideParams[originalPropertyName];
      if (!extendedProperty) {
        // Property is not overridden, keep original
        return { ...acc, [originalPropertyName]: rawOriginalProperty };
      }

      // SDK is under-typed, so we need to cast
      const originalProperty = rawOriginalProperty as { description?: string };
      const modifiedDescription = `${originalProperty.description}. Note: This parameter is ignored - it is hardcoded to be ${extendedProperty}. Pass an empty string for this parameter.`;
      const modifiedProperty = {
        ...originalProperty,
        description: modifiedDescription,
      };
      return {
        ...acc,
        [originalPropertyName]: modifiedProperty,
      };
    }, {});
    return { ...this.original.inputSchema, properties: modifiedProperties };
  }

  private static appendSentence(original: string, extra: string): string {
    const trimmed = original.trimEnd();
    return trimmed.endsWith(".")
      ? `${trimmed} ${extra}`
      : `${trimmed}. ${extra}`;
  }
}
