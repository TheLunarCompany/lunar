import {
  deleteDownstreamSessionAckSchema,
  listDownstreamSessionsAckSchema,
  loadDownstreamSessionAckSchema,
  persistedDownstreamSessionDataSchema,
  PersistedDownstreamSessionDataWire,
  storeDownstreamSessionAckSchema,
  WEBAPP_BOUND_EVENTS,
  wrapInEnvelope,
} from "@mcpx/webapp-protocol/messages";
import { parse as parseSemVer, SemVer } from "semver";
import { Logger } from "winston";
import { z } from "zod/v4";
import {
  DownstreamSessionStore,
  PersistedDownstreamSessionData,
  PersistedDownstreamSessionEntry,
} from "./downstream-session-store.js";
import { HubSocketAdapter } from "./saved-setups-client.js";

// Fail soft: `semver.parse` returns null (never throws) on a bad version, so it
// can't escape the transform and reject the whole recovery list. Drop the
// version instead. A throw here would bypass safeParse and break recovery.
function toSemVer(version: string | undefined): SemVer | undefined {
  return version === undefined
    ? undefined
    : (parseSemVer(version) ?? undefined);
}

// wire → domain: validates Hub response and reconstructs SemVer instances
const inboundSessionSchema = persistedDownstreamSessionDataSchema.transform(
  (wire): PersistedDownstreamSessionData => ({
    metadata: {
      ...wire.metadata,
      clientInfo: {
        ...wire.metadata.clientInfo,
        adapter: wire.metadata.clientInfo.adapter
          ? {
              name: wire.metadata.clientInfo.adapter.name,
              version: toSemVer(wire.metadata.clientInfo.adapter.version),
              support: wire.metadata.clientInfo.adapter.support,
            }
          : undefined,
      },
    },
  }),
);

// domain → wire: validates domain data and serializes SemVer to string
const outboundSessionSchema = z.object({
  metadata: z.object({
    consumerTag: z.string().optional(),
    clientId: z.string(),
    llm: z
      .object({
        provider: z.string().optional(),
        modelId: z.string().optional(),
      })
      .optional(),
    clientInfo: z.object({
      protocolVersion: z.string().optional(),
      name: z.string().optional(),
      version: z.string().optional(),
      title: z.string().optional(),
      websiteUrl: z.string().optional(),
      icons: z
        .array(
          z.object({
            src: z.string(),
            mimeType: z.string().optional(),
            sizes: z.array(z.string()).optional(),
          }),
        )
        .optional(),
      adapter: z
        .object({
          name: z.literal("mcp-remote"),
          version: z
            .instanceof(SemVer)
            .transform((v): string => v.toString())
            .optional(),
          support: z.object({ ping: z.boolean() }).optional(),
        })
        .optional(),
    }),
    isProbe: z.boolean(),
    authorization: z.string().optional(),
  }),
}) satisfies z.ZodType<
  PersistedDownstreamSessionDataWire,
  PersistedDownstreamSessionData
>;

export class HubDownstreamSessionClient implements DownstreamSessionStore {
  private readonly logger: Logger;

  constructor(
    private readonly getSocket: () => HubSocketAdapter | null,
    logger: Logger,
  ) {
    this.logger = logger.child({ component: "HubDownstreamSessionClient" });
  }

  async store(
    sessionId: string,
    data: PersistedDownstreamSessionData,
  ): Promise<void> {
    const socket = this.getSocket();
    if (!socket) return;
    const envelope = wrapInEnvelope({
      payload: { sessionId, data: outboundSessionSchema.parse(data) },
    });
    const raw = await socket.emitWithAck(
      WEBAPP_BOUND_EVENTS.STORE_DOWNSTREAM_SESSION,
      envelope,
    );
    const parsed = storeDownstreamSessionAckSchema.safeParse(raw);
    if (!parsed.success) {
      this.logger.warn("Failed to store downstream session in hub", {
        sessionId,
        error: parsed.error.message,
      });
    } else if (!parsed.data.success) {
      this.logger.warn("Failed to store downstream session in hub", {
        sessionId,
        error: parsed.data.error,
      });
    }
  }

  async load(
    sessionId: string,
  ): Promise<PersistedDownstreamSessionData | undefined> {
    const socket = this.getSocket();
    if (!socket) return undefined;
    const envelope = wrapInEnvelope({ payload: { sessionId } });
    const raw = await socket.emitWithAck(
      WEBAPP_BOUND_EVENTS.LOAD_DOWNSTREAM_SESSION,
      envelope,
    );
    const parsed = loadDownstreamSessionAckSchema.safeParse(raw);
    if (!parsed.success) {
      this.logger.warn("Invalid ack for load-downstream-session", {
        sessionId,
        error: parsed.error.message,
      });
      return undefined;
    }
    if (!parsed.data.success) {
      this.logger.warn("Hub refused load-downstream-session", {
        sessionId,
        error: parsed.data.error,
      });
      return undefined;
    }
    if (!parsed.data.data) return undefined;
    const domain = inboundSessionSchema.safeParse(parsed.data.data);
    if (!domain.success) {
      this.logger.warn("Invalid persisted session data from hub", {
        sessionId,
        error: domain.error.message,
      });
      return undefined;
    }
    return domain.data;
  }

  // Throws on failure (no socket, bad/refused ack) so callers can tell an
  // authoritative empty list from a transient failure. Corrupt records are skipped.
  async list(): Promise<PersistedDownstreamSessionEntry[]> {
    const socket = this.getSocket();
    if (!socket) {
      throw new Error("Hub socket not available for list-downstream-sessions");
    }
    const envelope = wrapInEnvelope({ payload: {} });
    const raw = await socket.emitWithAck(
      WEBAPP_BOUND_EVENTS.LIST_DOWNSTREAM_SESSIONS,
      envelope,
    );
    const parsed = listDownstreamSessionsAckSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `Invalid ack for list-downstream-sessions: ${parsed.error.message}`,
      );
    }
    if (!parsed.data.success) {
      throw new Error(
        `Hub refused list-downstream-sessions: ${parsed.data.error}`,
      );
    }
    const entries: PersistedDownstreamSessionEntry[] = [];
    for (const entry of parsed.data.sessions) {
      const domain = inboundSessionSchema.safeParse(entry.data);
      if (!domain.success) {
        // Skip a corrupt record so one bad value can't fail recovery.
        this.logger.warn("Invalid persisted session in list from hub", {
          sessionId: entry.sessionId,
          error: domain.error.message,
        });
        continue;
      }
      entries.push({ sessionId: entry.sessionId, data: domain.data });
    }
    return entries;
  }

  async delete(sessionId: string): Promise<void> {
    const socket = this.getSocket();
    if (!socket) return;
    const envelope = wrapInEnvelope({ payload: { sessionId } });
    const raw = await socket.emitWithAck(
      WEBAPP_BOUND_EVENTS.DELETE_DOWNSTREAM_SESSION,
      envelope,
    );
    const parsed = deleteDownstreamSessionAckSchema.safeParse(raw);
    if (!parsed.success) {
      this.logger.warn("Failed to delete downstream session from hub", {
        sessionId,
        error: parsed.error.message,
      });
    } else if (!parsed.data.success) {
      this.logger.warn("Failed to delete downstream session from hub", {
        sessionId,
        error: parsed.data.error,
      });
    }
  }
}
