import { IncomingHttpHeaders } from "http";
import {
  McpClientAdapter,
  McpClientInfo,
  McpxSession,
} from "../model/sessions.js";
import z from "zod/v4";
import { parse } from "semver";
import { headerString } from "@aigw/core/http";
import { AGENT_REGISTRY, resolveCanonicalName } from "@mcpx/shared-model";

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

// This utility function is used to scope client names that should be ignored.
// This is required since some clients (e.g. `mcp-remote`) might initiate
// a "probe" connection to the server, to detect if it's up/requires auth.
// Responsible clients might do this by a designated client name,
// which we can detect and handle accordingly.
const PROBE_CLIENT_NAMES = new Set(["mcp-remote-fallback-test"]);

const MCP_REMOTE_VERSION_PATTERN =
  /via mcp-remote[ /-]?([0-9]+\.[0-9]+\.[0-9]+)/;

export function isProbeClient(clientName?: string): boolean {
  return clientName ? PROBE_CLIENT_NAMES.has(clientName) : false;
}

export function extractMetadata(
  headers: IncomingHttpHeaders,
  body: unknown,
): McpxSession["metadata"] {
  const consumerTag = headerString(headers, "x-lunar-consumer-tag");
  const llmProvider = headerString(headers, "x-lunar-llm-provider");
  const llmModelId = headerString(headers, "x-lunar-llm-model-id");
  const authorization = headerString(headers, "authorization");

  // Generate a unique id for the client
  const clientId = generateClientId();

  const llm =
    llmProvider && llmModelId
      ? { provider: llmProvider, modelId: llmModelId }
      : undefined;

  const clientInfo = parseClientInfo(body);
  const isProbe = isProbeClient(clientInfo.name);

  return { consumerTag, llm, clientInfo, clientId, isProbe, authorization };
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
  const adapterResult = extractAdapter(rawClientName);
  const nameWithoutAdapter = adapterResult?.nameWithoutAdapter ?? rawClientName;
  const normalizedName = resolveCanonicalName(
    nameWithoutAdapter,
    AGENT_REGISTRY,
  );

  return {
    protocolVersion,
    name: normalizedName,
    version: rawInfo.version,
    title: rawInfo.title,
    websiteUrl: rawInfo.websiteUrl,
    icons: rawInfo.icons,
    adapter: adapterResult?.adapter,
  };
}

function extractAdapter(
  clientName: string,
): { adapter: McpClientAdapter; nameWithoutAdapter: string } | undefined {
  const viaIdx = clientName.indexOf(" (via ");
  if (viaIdx < 0 || !clientName.includes("via mcp-remote")) {
    return undefined;
  }

  const versionMatch = clientName.match(MCP_REMOTE_VERSION_PATTERN);
  const versionString = versionMatch?.[1];
  const version = versionString
    ? (parse(versionString) ?? undefined)
    : undefined;

  return {
    adapter: { name: "mcp-remote", version },
    nameWithoutAdapter: clientName.substring(0, viaIdx),
  };
}
