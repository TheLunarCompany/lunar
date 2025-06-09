import { Logger } from "winston";
import { ConfigManager } from "../config.js";
import { PermissionManager } from "./permissions.js";
import { TargetClients } from "./target-clients.js";
import { SessionsManager } from "./sessions.js";
import { MetricRecorder } from "./metric-recorder.js";
import { systemClock } from "../utils/time.js";

export class Services {
  private _sessions: SessionsManager;
  private _targetClients: TargetClients;
  private _permissionManager: PermissionManager;
  private _metricRecorder: MetricRecorder;

  private logger: Logger;
  private initialized = false;

  constructor(config: ConfigManager, logger: Logger) {
    this._metricRecorder = new MetricRecorder(systemClock, logger);
    this._sessions = new SessionsManager(this._metricRecorder);
    this._targetClients = new TargetClients(this._metricRecorder, logger);
    this._permissionManager = new PermissionManager(config);
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    this._permissionManager.initialize();
    await this._targetClients.initialize();
    this.initialized = true;
  }

  shutdown(): void {
    this.logger.info("Shutting down services...");

    // Close all sessions
    this._sessions.shutdown();

    // Shutdown target clients
    this._targetClients.shutdown();

    this.logger.info("All services shut down successfully");
  }

  ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error("Services not initialized");
    }
  }

  get sessions(): SessionsManager {
    this.ensureInitialized();
    return this._sessions;
  }
  get targetClients(): TargetClients {
    this.ensureInitialized();
    return this._targetClients;
  }
  get permissionManager(): PermissionManager {
    this.ensureInitialized();
    return this._permissionManager;
  }

  get metricRecorder(): MetricRecorder {
    this.ensureInitialized();
    return this._metricRecorder;
  }
}
