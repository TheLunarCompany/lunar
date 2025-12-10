import { loggableError } from "@mcpx/toolkit-core/logging";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { Logger } from "winston";
import { McpxSession } from "../model/sessions.js";
import { Services } from "../services/services.js";

const PING_TIMEOUT_FACTOR = 0.8;

type PingResult =
  | { type: "timeout" }
  | { type: "failure"; error: Error }
  | { type: "success" };

export function setupPingMonitoring(
  server: Server,
  transport: Transport,
  sessionId: string,
  metadata: McpxSession["metadata"],
  options: {
    pingIntervalMs: number;
    maxMissedPings: number;
  },
  logger: Logger,
): () => void {
  if (metadata.clientInfo.adapter?.support?.ping === false) {
    logger.info(
      "Client adapter does not support ping, skipping ping monitoring",
      { sessionId, metadata },
    );
    // return a no-op function
    return () => {};
  }
  const { pingIntervalMs, maxMissedPings } = options;
  const pingTimeoutMs = Math.floor(pingIntervalMs * PING_TIMEOUT_FACTOR);
  let missedPings = 0;

  const executePingWithTimeout = async (): Promise<PingResult> => {
    const timeoutPromise = new Promise<PingResult>((resolve) => {
      setTimeout(() => resolve({ type: "timeout" as const }), pingTimeoutMs);
    });

    const pingPromise = server
      .ping()
      .then(() => ({ type: "success" as const }))
      .catch((error) => ({ type: "failure" as const, error }));

    return Promise.race([pingPromise, timeoutPromise]);
  };

  let pingInProgress = false;

  const interval = setInterval(async (): Promise<void> => {
    if (pingInProgress) {
      logger.silly("Skipping ping, previous ping still in progress");
      return;
    }
    pingInProgress = true;
    const result = await executePingWithTimeout().catch((error) => {
      logger.error("Unexpected error during ping", {
        error,
        sessionId,
        metadata,
      });
      return { type: "failure" as const, error };
    });
    switch (result.type) {
      case "timeout":
        logger.warn("Ping timed out", { sessionId, metadata, missedPings });
        break;
      case "failure":
        logger.warn("Ping failed", {
          sessionId,
          metadata,
          missedPings,
          error: loggableError(result.error),
        });
        break;
      case "success":
        logger.silly("Ping successful", { sessionId, metadata });
        break;
    }

    if (result.type !== "success") {
      missedPings += 1;
      if (missedPings >= maxMissedPings) {
        logger.debug(
          `Missed ${maxMissedPings} consecutive pings, closing transport`,
          { sessionId, metadata },
        );
        await transport.close();
      }
    } else {
      if (missedPings > 0) {
        logger.debug("Ping successful, resetting missed pings counter", {
          metadata,
          sessionId,
          missedPings,
        });
      }

      missedPings = 0;
    }

    pingInProgress = false;
    logger.silly("Ping check complete", {
      metadata,
      result,
      missedPings,
    });
  }, pingIntervalMs);

  let stopped = false;
  return () => {
    if (stopped) {
      return;
    }
    logger.debug("Stopping ping monitoring", { sessionId, metadata });
    clearInterval(interval);
    stopped = true;
  };
}

export function scheduleProbeTransportTermination(
  services: Services,
  server: Server,
  transport: Transport,
  options: {
    probeClientsGraceLivenessPeriodMs: number;
  },
  stopPing: () => void,
): void {
  setTimeout(async () => {
    await server.close().catch(() => {
      // Ignore errors on close
    });
    if (transport.sessionId) {
      services.sessions.removeSession(transport.sessionId);
    }
    stopPing();
  }, options.probeClientsGraceLivenessPeriodMs);
}
