import { IncomingHttpHeaders } from "http";
import {
  McpClientAdapter,
  McpClientInfo,
  McpClientIcon,
  McpxSession,
} from "../model/sessions.js";
import z from "zod/v4";
import { parse, SemVer } from "semver";
import { Logger } from "winston";

/** Schema for client icons (version 2025-11-25) */
const clientIconSchema = z.object({
  src: z.string(),
  mimeType: z.string().optional(),
  sizes: z.array(z.string()).optional(),
});

/** Schema for the full clientInfo from MCP protocol */
const clientInfoSchema = z.object({
  name: z.string(),
  version: z.string(),
  title: z.string().optional(),
  websiteUrl: z.string().optional(),
  icons: z.array(clientIconSchema).optional(),
});

/** Schema for initialize request body */
const initializeRequestSchema = z.object({
  params: z.object({
    protocolVersion: z.string(),
    clientInfo: clientInfoSchema,
  }),
});

// Aliases for client names that should be normalized to the canonical name
const CLIENT_NAME_ALIASES = new Map<string, string>([
  ["openai-mcp (ChatGPT)", "openai-mcp"],
  ["Anthropic", "Anthropic/ClaudeAI"],
]);

// This utility function is used to scope client names that should be ignored.
// This is required since some clients (e.g. `mcp-remote`) might initiate
// a "probe" connection to the server, to detect if it's up/requires auth.
// Responsible clients might do this by a designated client name,
// which we can detect and handle accordingly.
const PROBE_CLIENT_NAMES = new Set(["mcp-remote-fallback-test"]);

const MCP_REMOTE_VERSION_PATTERN =
  /via mcp-remote[ /-]?([0-9]+\.[0-9]+\.[0-9]+)/;

const LATEST_SUPPORTED_MCP_REMOTE_VERSION = new SemVer("0.1.21");

export function isProbeClient(clientName?: string): boolean {
  return clientName ? PROBE_CLIENT_NAMES.has(clientName) : false;
}

export function logMetadataWarnings(
  metadata: McpxSession["metadata"],
  sessionId: string | undefined,
  logger: Logger,
): void {
  const { adapter } = metadata.clientInfo;
  if (adapter?.name === "mcp-remote" && adapter.support?.ping === false) {
    logger.warn(
      `Detected usage of mcp-remote out of supported versions range. ` +
        `We recommend anchoring your mcp-remote version in the agent configuration. ` +
        `Replace \`mcp-remote\` with \`mcp-remote@${LATEST_SUPPORTED_MCP_REMOTE_VERSION.version}\``,
      { sessionId, metadata },
    );
  }
}

export function extractMetadata(
  headers: IncomingHttpHeaders,
  body: unknown,
): McpxSession["metadata"] {
  const consumerTag = headers["x-lunar-consumer-tag"] as string | undefined;
  const llmProvider = headers["x-lunar-llm-provider"] as string | undefined;
  const llmModelId = headers["x-lunar-llm-model-id"] as string | undefined;

  // Generate a unique id for the client
  const clientId = generateClientId();

  const llm =
    llmProvider && llmModelId
      ? { provider: llmProvider, modelId: llmModelId }
      : undefined;

  const clientInfo = parseClientInfo(body);
  const isProbe = isProbeClient(clientInfo.name);

  return { consumerTag, llm, clientInfo, clientId, isProbe };
}

function generateClientId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 11);
  return `client-${timestamp}-${random}`;
}

function parseClientInfo(body: unknown): McpClientInfo {
  const parsed = initializeRequestSchema.safeParse(body);

  if (!parsed.success) {
    return {};
  }

  const { protocolVersion, clientInfo: rawInfo } = parsed.data.params;
  const rawClientName = rawInfo.name;
  const normalizedName = normalizeClientName(rawClientName);
  const adapter = extractAdapter(rawClientName);

  return {
    protocolVersion,
    name: normalizedName,
    version: rawInfo.version,
    title: rawInfo.title,
    websiteUrl: rawInfo.websiteUrl,
    icons: rawInfo.icons as McpClientIcon[] | undefined,
    adapter,
  };
}

function normalizeClientName(clientName: string): string {
  return CLIENT_NAME_ALIASES.get(clientName) ?? clientName;
}

function extractAdapter(clientName: string): McpClientAdapter | undefined {
  if (!clientName.includes("via mcp-remote")) {
    return undefined;
  }

  const versionMatch = clientName.match(MCP_REMOTE_VERSION_PATTERN);
  const versionString = versionMatch?.[1];
  const version = versionString
    ? (parse(versionString) ?? undefined)
    : undefined;
  const support = getAdapterSupport("mcp-remote", version);

  return { name: "mcp-remote", version, support };
}

function getAdapterSupport(
  name: string,
  version: SemVer | undefined,
): McpClientAdapter["support"] | undefined {
  if (name !== "mcp-remote" || !version) {
    return undefined;
  }

  const supportsPing =
    version.compare(LATEST_SUPPORTED_MCP_REMOTE_VERSION) <= 0;
  return { ping: supportsPing };
}
