import { loggableError } from "@mcpx/toolkit-core/logging";
import { McpxSession } from "../model/sessions.js";
import { SystemStateTracker } from "./system-state.js";
import { Logger } from "winston";

export class SessionsManager {
  private _sessions: Record<string, McpxSession>;
  private systemState: SystemStateTracker;
  private logger: Logger;

  constructor(metricRecorder: SystemStateTracker, logger: Logger) {
    this._sessions = {};
    this.systemState = metricRecorder;
    this.logger = logger.child({ component: "SessionsManager" });
  }

  getSession(sessionId: string): McpxSession | undefined {
    return this._sessions[sessionId];
  }

  addSession(sessionId: string, session: McpxSession): void {
    this._sessions[sessionId] = session;
    this.systemState.recordClientConnected({
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
    this.systemState.recordClientDisconnected({ sessionId });
  }

  get sessions(): Record<string, McpxSession> {
    return this._sessions;
  }

  async shutdown(): Promise<void> {
    for (const sessionId in this._sessions) {
      const session = this._sessions[sessionId];
      if (session) {
        this.logger.info("Closing session transport", { sessionId });
        await session.transport.transport.close().catch((e) => {
          const error = loggableError(e);
          this.logger.error("Error closing session transport", error);
        });
        delete this._sessions[sessionId];
      }
    }
  }
}
