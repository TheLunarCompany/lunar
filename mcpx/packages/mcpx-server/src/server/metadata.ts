import { IncomingHttpHeaders } from "http";
import { McpClientAdapter, McpxSession } from "../model/sessions.js";
import z from "zod/v4";
import { parse, SemVer } from "semver";
import { Logger } from "winston";

const requestBodySchema = z.object({
  params: z.object({
    protocolVersion: z.string(),
    clientInfo: z.object({ name: z.string(), version: z.string() }),
  }),
});

// This utility function is used to scope client names that should be ignored.
// This is required since some clients (e.g. `mcp-remote`) might initiate
// a "probe" connection to the server, to detect if it's up/requires auth.
// Responsible clients might do this by a designated client name,
// which we can detect and handle accordingly.
const probeClientNames = new Set(["mcp-remote-fallback-test"]);
export function isProbeClient(clientName?: string): boolean {
  if (!clientName) {
    return false;
  }
  return probeClientNames.has(clientName);
}

const CLAUDE_VIA_MCP_REMOTE_VERSION_PATTERN =
  /via mcp-remote[ /-]?([0-9]+\.[0-9]+\.[0-9]+)/;

const LATEST_SUPPORTED_MCP_REMOTE_VERSION = new SemVer("0.1.21");

export function logMetadataWarnings(
  metadata: McpxSession["metadata"],
  sessionId: string | undefined,
  logger: Logger,
): void {
  if (metadata.clientInfo.adapter?.support?.ping === false) {
    if (metadata.clientInfo.adapter.name === "mcp-remote") {
      logger.warn(
        `Detected usage of mcp-remote out of supported versions range. We recommend anchoring your mcp-remote version in the agent configuration. Replace \`mcp-remote\` with \`mcp-remote@${LATEST_SUPPORTED_MCP_REMOTE_VERSION.version}\``,
        { sessionId, metadata },
      );
    }
  }
}

export function extractMetadata(
  headers: IncomingHttpHeaders,
  body: unknown,
): McpxSession["metadata"] {
  const consumerTag = headers["x-lunar-consumer-tag"] as string | undefined;
  const llmProvider = headers["x-lunar-llm-provider"] as string | undefined;
  const llmModelId = headers["x-lunar-llm-model-id"] as string | undefined;
  // generate a unique id for the client
  const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const llm =
    llmProvider && llmModelId
      ? { provider: llmProvider, modelId: llmModelId }
      : undefined;

  const parsedBody = requestBodySchema.safeParse(body);
  let clientInfo: McpxSession["metadata"]["clientInfo"] = {};

  if (parsedBody.success) {
    let clientAdapter: McpClientAdapter | undefined = undefined;
    const clientName = parsedBody.data.params.clientInfo.name;
    clientAdapter = extractAdapter(clientName);
    clientInfo = {
      protocolVersion: parsedBody.data.params.protocolVersion,
      name: clientName,
      version: parsedBody.data.params.clientInfo.version,
      adapter: clientAdapter,
    };
  }
  const isProbe = isProbeClient(clientInfo?.name);

  return { consumerTag, llm, clientInfo, clientId, isProbe };
}

function extractAdapter(clientName: string): McpClientAdapter | undefined {
  const adapterName = clientName.includes("via mcp-remote")
    ? "mcp-remote"
    : undefined;
  if (adapterName === "mcp-remote") {
    const versionMatch = clientName.match(
      CLAUDE_VIA_MCP_REMOTE_VERSION_PATTERN,
    );
    const versionString = versionMatch ? versionMatch[1] : undefined;
    const version = versionString
      ? parse(versionString) || undefined
      : undefined;
    const support = extractAdapterSupport(adapterName, version);
    return {
      name: adapterName,
      version,
      support,
    };
  }
  return undefined;
}

function extractAdapterSupport(
  name: string,
  version: SemVer | undefined,
): McpClientAdapter["support"] | undefined {
  if (name === "mcp-remote") {
    if (!version) {
      return undefined;
    }
    if (version <= LATEST_SUPPORTED_MCP_REMOTE_VERSION) {
      return { ping: true };
    }
    return { ping: false };
  }
  return undefined;
}
