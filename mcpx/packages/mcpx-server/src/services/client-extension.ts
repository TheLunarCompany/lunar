import { indexBy, makeError } from "@mcpx/toolkit-core/data";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  ErrorCode,
  McpError,
  PromptListChangedNotificationSchema,
  Tool,
  ToolListChangedNotificationSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { ConfigService, ConfigSnapshot } from "../config.js";
import {
  ServiceToolExtensions,
  ToolExtension,
  ExtensionDescription,
} from "../model/config/tool-extensions.js";
import { z } from "zod";
import { ZodError } from "zod/v4";
import { Logger } from "winston";
import { loggableError } from "@mcpx/toolkit-core/logging";

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

export type ExtendedListToolsResponse = ListToolsResponse & {
  toolParentNames: Record<string, string>;
};

export type OriginalClientI = Pick<
  Client,
  | "connect"
  | "close"
  | "listTools"
  | "callTool"
  | "listPrompts"
  | "getPrompt"
  | "setNotificationHandler"
  | "ping"
>;

// "method-not-found":
// -32601 means the server is alive but doesn't implement ping.
// SDK servers throw McpError directly; streamable-http transport wraps
// the JSON-RPC response body as a plain Error with the JSON in the message.

// "invalid-response-format":
// Some servers (e.g. LaunchDarkly-remote) return HTTP 200 to a ping but with a invalid JSON-RPC body.
// The server is reachable, so treat as alive but stop pinging it.
type PingUnsupportedReason = "method-not-found" | "invalid-response-format";

const PING_UNSUPPORTED_MESSAGES: Record<PingUnsupportedReason, string> = {
  "method-not-found":
    "Server does not implement ping — treating as alive, will not ping again",
  "invalid-response-format":
    "Server returned a malformed ping response — treating as alive, will not ping again",
};
export interface ExtendedClientBuilderI {
  build(props: {
    name: string;
    originalClient: OriginalClientI;
  }): Promise<ExtendedClientI>;
}

export interface ExtendedClientI {
  close(): Promise<void>;
  listTools(): Promise<ExtendedListToolsResponse>;
  callTool(
    params: Parameters<Client["callTool"]>[0],
  ): ReturnType<Client["callTool"]>;
  listPrompts(): ReturnType<Client["listPrompts"]>;
  getPrompt(
    params: Parameters<Client["getPrompt"]>[0],
  ): ReturnType<Client["getPrompt"]>;
  isAlive(timeoutMs: number): Promise<Error | null>;
  onToolsListChanged(callback: () => void): () => void;
  onPromptsListChanged(callback: () => void): () => void;
}

export class ExtendedClientBuilder {
  constructor(
    private configService: ConfigService,
    private logger: Logger,
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
      this.logger.child({ component: "ExtendedClient", name }),
    );

    const unsubscribeConfig = this.configService.subscribe(
      (_configSnapshot: ConfigSnapshot) => {
        extendedClient.invalidateCache();
      },
    );

    const toolsListChangedListeners = new Set<() => void>();
    const promptsListChangedListeners = new Set<() => void>();

    originalClient.setNotificationHandler(
      ToolListChangedNotificationSchema,
      () => {
        extendedClient.invalidateCache();
        for (const listener of toolsListChangedListeners) {
          listener();
        }
      },
    );

    originalClient.setNotificationHandler(
      PromptListChangedNotificationSchema,
      () => {
        for (const listener of promptsListChangedListeners) {
          listener();
        }
      },
    );

    return {
      async close(): Promise<void> {
        toolsListChangedListeners.clear();
        promptsListChangedListeners.clear();
        unsubscribeConfig();
        return await extendedClient.close.bind(extendedClient)();
      },
      listTools: extendedClient.listTools.bind(extendedClient),
      callTool: extendedClient.callTool.bind(extendedClient),
      listPrompts: extendedClient.listPrompts.bind(extendedClient),
      getPrompt: extendedClient.getPrompt.bind(extendedClient),
      isAlive: extendedClient.isAlive.bind(extendedClient),
      onToolsListChanged(callback: () => void): () => void {
        toolsListChangedListeners.add(callback);
        return () => toolsListChangedListeners.delete(callback);
      },
      onPromptsListChanged(callback: () => void): () => void {
        promptsListChangedListeners.add(callback);
        return () => promptsListChangedListeners.delete(callback);
      },
    };
  }
}

// Transport errors (network down, connection reset, timeout) are plain Errors.
// MCP application errors (tool not found, invalid params) are McpError instances.
export function isTransportError(e: unknown): boolean {
  return e instanceof Error && !(e instanceof McpError);
}

export function isMethodNotFoundError(e: unknown): boolean {
  if (e instanceof McpError && e.code === ErrorCode.MethodNotFound) {
    return true;
  }
  // StreamableHTTP transport serialises the JSON-RPC error into the message string
  // rather than throwing McpError, so we also check the embedded code.
  return (
    e instanceof Error &&
    e.message.includes(`"code":${ErrorCode.MethodNotFound}`)
  );
}

export function isInvalidResponseFormatError(e: unknown): boolean {
  return e instanceof ZodError;
}

export class ExtendedClient {
  private cachedListToolsResponse?: ListToolsResponse;
  private cachedExtendedTools?: Record<string, ExtendedTool>;
  private pingSupported = true;

  constructor(
    private serviceName: string,
    private originalClient: OriginalClientI,
    private getServiceToolExtensions: () => ServiceToolExtensions,
    private logger: Logger,
  ) {}

  async close(): Promise<void> {
    return await this.originalClient.close();
  }

  async listPrompts(): ReturnType<Client["listPrompts"]> {
    return this.originalClient.listPrompts();
  }

  async getPrompt(
    params: Parameters<Client["getPrompt"]>[0],
  ): ReturnType<Client["getPrompt"]> {
    return this.originalClient.getPrompt(params);
  }

  async listTools(): Promise<ExtendedListToolsResponse> {
    const originalResponse = await this.originalClient.listTools();
    const enrichedTools = originalResponse.tools.flatMap((tool) =>
      this.extendTool(tool),
    );

    this.cachedListToolsResponse = originalResponse;
    this.cachedExtendedTools = indexBy(
      enrichedTools,
      (tool) => tool.extendedName,
    );

    return this.extendedListToolsResponse();
  }

  async callTool(
    params: Parameters<Client["callTool"]>[0],
  ): ReturnType<Client["callTool"]> {
    if (!this.cachedListToolsResponse || !this.cachedExtendedTools) {
      await this.listTools();
    }

    const extendedTool = this.cachedExtendedTools?.[params.name];

    if (!extendedTool) {
      return await this.originalClient.callTool(params);
    }
    const modifiedArguments = extendedTool.buildArguments(params.arguments);

    // Call the original tool with modified arguments
    const { name: _toolName, ...rest } = params;
    return await this.originalClient.callTool({
      ...rest,
      name: extendedTool.originalName,
      arguments: modifiedArguments,
    });
  }

  async isAlive(timeoutMs: number): Promise<Error | null> {
    if (!this.pingSupported) {
      return null;
    }
    return this.originalClient
      .ping({ timeout: timeoutMs })
      .then(() => null)
      .catch((e) => {
        const unsupported = this.isPingUnsupported(e);
        if (unsupported.result) {
          this.pingSupported = false;
          this.logger.warn(PING_UNSUPPORTED_MESSAGES[unsupported.reason], {
            name: this.serviceName,
          });
          this.logger.debug("PING error while the server is responsing:", {
            name: this.serviceName,
            error: loggableError(e),
          });
          return null;
        }
        return makeError(e);
      });
  }

  invalidateCache(): void {
    this.cachedExtendedTools = undefined;
    this.cachedListToolsResponse = undefined;
  }

  private extendedListToolsResponse(): ExtendedListToolsResponse {
    const extendedTools = Object.values(this.cachedExtendedTools || {});
    const allTools = [
      ...(this.cachedListToolsResponse?.tools || []),
      ...extendedTools.map((tool) => tool.asTool()),
    ];
    const toolParentNames = Object.fromEntries(
      extendedTools.map((tool) => [tool.extendedName, tool.originalName]),
    );
    return {
      ...this.cachedListToolsResponse,
      tools: allTools,
      toolParentNames,
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

  private isPingUnsupported(
    e: unknown,
  ): { result: true; reason: PingUnsupportedReason } | { result: false } {
    if (isMethodNotFoundError(e))
      return { result: true, reason: "method-not-found" };
    if (isInvalidResponseFormatError(e))
      return { result: true, reason: "invalid-response-format" };
    return { result: false };
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
      annotations: this.original.annotations,
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
