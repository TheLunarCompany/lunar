import { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import { normalizeServerName } from "@mcpx/toolkit-core/data";
import { NotAllowedError, NotFoundError } from "../errors.js";
import { InitiateOAuthResult } from "./oauth-connection-handler.js";
import {
  InternalCapabilityProvider,
  InternalToolHandler,
} from "./internal-tools-service.js";
import { PermissionCheck } from "./capability-resolver.js";

export const SERVICE_DELIMITER = "__";
export const AUTH_TOOL_NAME = "request_authentication_link";

interface OAuthUpstreamHandler {
  initiateOAuthForServer(
    targetServerName: string,
    callbackUrl?: string,
  ): Promise<InitiateOAuthResult>;
}

function buildAuthToolDescription(serviceName: string): string {
  return [
    `Initiates OAuth authentication for the **${serviceName}** server and returns a sign-in URL.`,
    "",
    "**When to call:**",
    `- ${serviceName} tools are unavailable because authentication is required`,
    `- A ${serviceName} tool call fails with an authentication/authorization error`,
    `- The user asks to re-authenticate or reconnect to ${serviceName}`,
    "",
    "**After calling:**",
    `1. Present the returned URL as a clickable markdown link: [Sign in to ${serviceName}](<url>)`,
    "2. Ask the user to complete sign-in in their browser",
    "3. For device-flow: also show the returned **user_code** — the user must enter it on the sign-in page",
    "4. Once the user completes sign-in, retry the original request — the real tools will be available",
    "",
    "**Returns:** authorization URL, and optionally a user_code for device-flow servers (e.g. GitHub).",
  ].join("\n");
}

// The registered tool name is unprefixed; the registry prefixes it with the
// owning serverName (e.g. "github__request_authentication_link"). Description
// still references the serviceName so the agent knows which server it targets.
export function buildAuthToolDefinition(serviceName: string): Tool {
  return {
    name: AUTH_TOOL_NAME,
    description: buildAuthToolDescription(serviceName),
    inputSchema: { type: "object" as const, properties: {} },
  };
}

export class OAuthToolsService implements InternalCapabilityProvider {
  constructor(
    private readonly upstreamHandler: OAuthUpstreamHandler,
    private readonly permissions: PermissionCheck,
    private readonly callbackUrl?: string,
  ) {}

  // Auth tool respects the consumer's permissions for the owning server, even
  // though origin="internal" otherwise bypasses catalog/permission gating.
  // Without this, restrictive toolgroups would still see the auth tool — it'd
  // be the only origin="internal" entry that escapes their allow-list.
  getInternalCapabilityRegistrations(): ReturnType<
    InternalCapabilityProvider["getInternalCapabilityRegistrations"]
  > {
    const handler: InternalToolHandler = {
      toolName: AUTH_TOOL_NAME,
      isVisible: (consumer, cap) =>
        this.permissions.hasPermission({
          serviceName: cap.serverName,
          toolName: AUTH_TOOL_NAME,
          clientName: consumer.clientName,
          consumerTag: consumer.consumerTag,
        }),
      handle: ({ serverName }) => this.handleAuthToolCall(serverName),
    };
    return { handlers: [handler], eagerRegistrations: [] };
  }

  handleAuthToolCall(serverName: string): Promise<CallToolResult> {
    return this.upstreamHandler
      .initiateOAuthForServer(normalizeServerName(serverName), this.callbackUrl)
      .then((result) => {
        const lines = [result.authorizationUrl];
        if (result.userCode) {
          lines.push(`User code: ${result.userCode}`);
        }
        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      })
      .catch((error: unknown) => {
        if (
          error instanceof NotFoundError ||
          error instanceof NotAllowedError
        ) {
          return {
            content: [{ type: "text" as const, text: error.message }],
            isError: true,
          };
        }
        throw error;
      });
  }
}
