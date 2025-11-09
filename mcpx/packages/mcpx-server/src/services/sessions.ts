import { loggableError } from "@mcpx/toolkit-core/logging";
import { McpxSession } from "../model/sessions.js";
import { SystemStateTracker } from "./system-state.js";
import { Logger } from "winston";
import { ConnectedClientAdapter } from "@mcpx/shared-model";

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

  async addSession(sessionId: string, session: McpxSession): Promise<void> {
    this._sessions[sessionId] = session;
    if (session.metadata.isProbe) {
      // Don't record probe clients
      return;
    }
    this.systemState.recordClientConnected({
      sessionId,
      client: {
        clientId: session.metadata.clientId,
        consumerTag: session.metadata.consumerTag,
        llm: {
          provider: session.metadata.llm?.provider,
          modelId: session.metadata.llm?.modelId,
        },
        clientInfo: {
          ...session.metadata.clientInfo,
          adapter: this.prepareClientAdapter(
            session.metadata.clientInfo.adapter,
          ),
        },
      },
    });
  }

  private prepareClientAdapter(
    adapter: McpxSession["metadata"]["clientInfo"]["adapter"],
  ): ConnectedClientAdapter | undefined {
    if (!adapter) {
      return undefined;
    }
    const support = adapter.support;
    const semver = adapter.version;
    if (!semver) {
      return { name: adapter.name, support };
    }
    return {
      name: adapter.name,
      support,
      version: {
        major: semver.major,
        minor: semver.minor,
        patch: semver.patch,
        prerelease: [...semver.prerelease],
        build: [...semver.build],
      },
    };
  }

  removeSession(sessionId: string): void {
    delete this._sessions[sessionId];
    this.systemState.recordClientDisconnected({ sessionId });
  }

  get sessions(): Record<string, McpxSession> {
    return this._sessions;
  }

  async shutdown(): Promise<void> {
    await this.disconnectAllSessions();
  }

  private async disconnectAllSessions(): Promise<void> {
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
