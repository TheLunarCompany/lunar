import { indexBy } from "@mcpx/toolkit-core/data";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ConfigService, ConfigSnapshot } from "../config.js";
import {
  ServiceToolExtensions,
  ToolExtension,
  ExtensionDescription,
} from "../model/config/tool-extensions.js";
import { CatalogManagerI } from "./catalog-manager.js";
import { z } from "zod";

// JSON Schema property - the SDK types this as unknown but it's actually a JSON Schema object
const jsonSchemaPropertySchema = z.object({
  description: z.string().optional(),
});

export function extractToolParameters(
  tool: Tool,
): { name: string; description?: string }[] {
  const properties = tool.inputSchema?.properties;
  if (!properties) {
    return [];
  }
  return Object.entries(properties).map(([name, rawProperty]) => {
    const parsed = jsonSchemaPropertySchema.safeParse(rawProperty);
    return {
      name,
      description: parsed.success ? parsed.data.description : undefined,
    };
  });
}

type ListToolsResponse = Awaited<ReturnType<Client["listTools"]>>;

export type OriginalClientI = Pick<
  Client,
  "connect" | "close" | "listTools" | "callTool"
>;
export interface ExtendedClientBuilderI {
  build(props: {
    name: string;
    originalClient: OriginalClientI;
  }): Promise<ExtendedClientI>;
}

export interface ExtendedClientI {
  close(): Promise<void>;
  listTools(): ReturnType<Client["listTools"]>;
  originalTools(): Promise<ReturnType<Client["listTools"]>>;
  callTool(props: {
    name: string;
    arguments: Record<string, unknown> | undefined;
  }): ReturnType<Client["callTool"]>;
}

export class ExtendedClientBuilder {
  constructor(
    private configService: ConfigService,
    private catalogManager: CatalogManagerI,
  ) {}

  // TODO MCP-59: add test for caching?
  async build(props: {
    name: string;
    originalClient: OriginalClientI;
  }): Promise<ExtendedClientI> {
    const { name, originalClient } = props;
    const getServiceToolExtensions = (): ServiceToolExtensions =>
      this.configService.getConfig().toolExtensions.services[name] || {};
    const extendedClient = new ExtendedClient(
      name,
      originalClient,
      getServiceToolExtensions,
      this.catalogManager,
    );

    const unsubscribeConfig = this.configService.subscribe(
      (_configSnapshot: ConfigSnapshot) => {
        extendedClient.invalidateCache();
      },
    );

    const unsubscribeCatalog = this.catalogManager.subscribe(() => {
      extendedClient.invalidateCache();
    });

    return {
      async close(): Promise<void> {
        unsubscribeConfig();
        unsubscribeCatalog();
        return await extendedClient.close.bind(extendedClient)();
      },
      listTools: extendedClient.listTools.bind(extendedClient),
      originalTools: extendedClient.originalTools.bind(extendedClient),
      callTool: extendedClient.callTool.bind(extendedClient),
    };
  }
}

export class ExtendedClient {
  private cachedListToolsResponse?: ListToolsResponse;
  private cachedExtendedTools?: Record<string, ExtendedTool>;

  constructor(
    private serviceName: string,
    private originalClient: OriginalClientI,
    private getServiceToolExtensions: () => ServiceToolExtensions,
    private catalogManager: CatalogManagerI,
  ) {}

  async close(): Promise<void> {
    return await this.originalClient.close();
  }

  async originalTools(): Promise<ReturnType<Client["listTools"]>> {
    // Return the original tools without extensions, but still filtered by catalog approval
    const response = await this.originalClient.listTools();
    const approvedTools = response.tools.filter((tool) =>
      this.catalogManager.isToolApproved(this.serviceName, tool.name),
    );
    return { ...response, tools: approvedTools };
  }

  async listTools(): ReturnType<Client["listTools"]> {
    // Obtain tools and filter by catalog approval
    const originalResponse = await this.originalClient.listTools();
    const approvedTools = originalResponse.tools.filter((tool) =>
      this.catalogManager.isToolApproved(this.serviceName, tool.name),
    );

    // Extend approved tools only
    const enrichedTools = approvedTools.flatMap((tool) =>
      this.extendTool(tool),
    );

    // Persist
    this.cachedListToolsResponse = {
      ...originalResponse,
      tools: approvedTools,
    };
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
  }): ReturnType<Client["callTool"]> {
    if (!this.cachedListToolsResponse || !this.cachedExtendedTools) {
      await this.listTools();
    }

    const extendedTool = this.cachedExtendedTools?.[props.name];
    const originalToolName = extendedTool?.originalName ?? props.name;

    // Check catalog approval for the underlying tool
    if (
      !this.catalogManager.isToolApproved(this.serviceName, originalToolName)
    ) {
      throw new Error(`Tool ${props.name} is not approved`);
    }

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

  invalidateCache(): void {
    this.cachedExtendedTools = undefined;
    this.cachedListToolsResponse = undefined;
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
    const extensionConfig = this.getServiceToolExtensions()[originalTool.name];
    if (!extensionConfig) {
      return [];
    }
    return extensionConfig.childTools.map(
      (config) => new ExtendedTool(originalTool, config),
    );
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
    const result = original || {};

    // Apply parameter overrides - extract only the values
    for (const [paramName, override] of Object.entries(
      this.extension.overrideParams,
    )) {
      if (override.value !== undefined) {
        result[paramName] = override.value;
      }
    }

    return result;
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
    const description = this.buildToolDescription();
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

  private buildToolDescription(): string | null {
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

  private buildParamDescription(
    description: ExtensionDescription | undefined,
    originalDescription: string | undefined,
  ): string | null {
    if (!description) {
      return originalDescription || null;
    }
    switch (description.action) {
      case "append":
        return ExtendedTool.appendSentence(
          originalDescription || "",
          description.text,
        );
      case "rewrite":
        return description.text;
    }
  }

  private buildInputSchema(): Tool["inputSchema"] {
    const originalProperties = this.original.inputSchema.properties;
    if (!originalProperties) {
      return this.original.inputSchema;
    }

    const modifiedProperties = Object.entries(originalProperties).reduce<
      Record<string, object>
    >((acc, [originalPropertyName, rawOriginalProperty]) => {
      const extendedProperty =
        this.extension.overrideParams[originalPropertyName];
      if (!extendedProperty) {
        // Property is not overridden, keep original
        return { ...acc, [originalPropertyName]: rawOriginalProperty };
      }

      const originalProperty = this.typeProperty(rawOriginalProperty);
      const modifiedDescriptionByExtension = this.buildParamDescription(
        extendedProperty.description,
        originalProperty.description,
      );
      let modifiedDescription = modifiedDescriptionByExtension;
      if (extendedProperty.value !== undefined) {
        modifiedDescription = `${modifiedDescriptionByExtension}. Note: This parameter is ignored - it is hardcoded to be ${extendedProperty.value}. Pass an empty string for this parameter.`;
      }
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

  private typeProperty(
    rawOriginalProperty: object,
  ): object & { description?: string } {
    const parsed = jsonSchemaPropertySchema.safeParse(rawOriginalProperty);
    if (!parsed.success) {
      return rawOriginalProperty;
    }
    const { description } = parsed.data;

    return { ...rawOriginalProperty, description };
  }

  private static appendSentence(original: string, extra: string): string {
    if (original.trim() === "") {
      return extra;
    }
    const trimmed = original.trimEnd();
    return trimmed.endsWith(".")
      ? `${trimmed} ${extra}`
      : `${trimmed}. ${extra}`;
  }
}
