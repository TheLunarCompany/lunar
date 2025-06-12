import { logger } from "../logger.js";
import { McpxSession } from "../model.js";
import { loggableError } from "../utils/logging.js";
import { MetricRecorder } from "./metric-recorder.js";

export class SessionsManager {
  private _sessions: Record<string, McpxSession>;
  private metricRecorder: MetricRecorder;

  constructor(metricRecorder: MetricRecorder) {
    this._sessions = {};
    this.metricRecorder = metricRecorder;
  }

  getSession(sessionId: string): McpxSession | undefined {
    return this._sessions[sessionId];
  }

  addSession(sessionId: string, session: McpxSession): void {
    this._sessions[sessionId] = session;
    this.metricRecorder.recordClientConnected({
      sessionId,
      client: {
        consumerTag: session.metadata.consumerTag,
        llm: {
          provider: session.metadata.llm?.provider,
          modelId: session.metadata.llm?.modelId,
        },
      },
    });
  }

  removeSession(sessionId: string): void {
    delete this._sessions[sessionId];
    this.metricRecorder.recordClientDisconnected({ sessionId });
  }

  get sessions(): Record<string, McpxSession> {
    return this._sessions;
  }

  async shutdown(): Promise<void> {
    for (const sessionId in this._sessions) {
      const session = this._sessions[sessionId];
      if (session) {
        logger.info("Closing session transport", { sessionId });
        await session.transport.transport.close().catch((e) => {
          const error = loggableError(e);
          logger.error("Error closing session transport", error);
        });
        delete this._sessions[sessionId];
      }
    }
  }
}
