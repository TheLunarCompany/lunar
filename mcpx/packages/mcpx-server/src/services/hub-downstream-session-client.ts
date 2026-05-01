import {
  deleteDownstreamSessionAckSchema,
  loadDownstreamSessionAckSchema,
  persistedDownstreamSessionDataSchema,
  PersistedDownstreamSessionDataWire,
  storeDownstreamSessionAckSchema,
  WEBAPP_BOUND_EVENTS,
  wrapInEnvelope,
} from "@mcpx/webapp-protocol/messages";
import { SemVer } from "semver";
import { Logger } from "winston";
import { z } from "zod/v4";
import {
  DownstreamSessionStore,
  PersistedDownstreamSessionData,
} from "./downstream-session-store.js";
import { HubSocketAdapter } from "./saved-setups-client.js";

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
              version: wire.metadata.clientInfo.adapter.version
                ? new SemVer(wire.metadata.clientInfo.adapter.version)
                : undefined,
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
