import { Logger } from "winston";
import { ConfigManager } from "../config.js";
import { SystemStateTracker } from "./system-state.js";
import { PermissionManager } from "./permissions.js";
import { SessionsManager } from "./sessions.js";
import { TargetClients } from "./target-clients.js";
import { MetricRecorder } from "./metrics.js";
import { systemClock } from "@mcpx/toolkit-core/time";
import { MeterProvider } from "@opentelemetry/sdk-metrics";
import { ControlPlaneService } from "./control-plane-service.js";
import { ExtendedClientBuilder } from "./client-extension.js";
import { DockerService } from "./docker.js";
import { env } from "../env.js";

export class Services {
  private _sessions: SessionsManager;
  private _extendedClientBuilder: ExtendedClientBuilder;
  private _targetClients: TargetClients;
  private _permissionManager: PermissionManager;
  private _systemStateTracker: SystemStateTracker;
  private _controlPlane: ControlPlaneService;
  private _metricsRecord: MetricRecorder;
  private _dockerService: DockerService;
  private logger: Logger;
  private initialized = false;

  constructor(
    config: ConfigManager,
    meterProvider: MeterProvider,
    logger: Logger,
  ) {
    const systemStateTracker = new SystemStateTracker(systemClock);
    this._systemStateTracker = systemStateTracker;

    const sessionsManager = new SessionsManager(systemStateTracker, logger);
    this._sessions = sessionsManager;

    const extendedClientBuilder = new ExtendedClientBuilder(config);
    this._extendedClientBuilder = extendedClientBuilder;
    this._dockerService = new DockerService(
      env.MITM_PROXY_CA_CERT_PATH,
      logger,
    );
    const targetClients = new TargetClients(
      this._systemStateTracker,
      this._extendedClientBuilder,
      this._dockerService,
      logger,
    );
    this._targetClients = targetClients;

    this._permissionManager = new PermissionManager(config, logger);

    this._metricsRecord = new MetricRecorder(meterProvider);

    this._controlPlane = new ControlPlaneService(
      systemStateTracker,
      targetClients,
      sessionsManager,
      config,
      logger,
    );

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

  get systemStateTracker(): SystemStateTracker {
    this.ensureInitialized();
    return this._systemStateTracker;
  }

  get metricRecorder(): MetricRecorder {
    this.ensureInitialized();
    return this._metricsRecord;
  }

  get controlPlane(): ControlPlaneService {
    this.ensureInitialized();
    return this._controlPlane;
  }

  get dockerService(): DockerService {
    this.ensureInitialized();
    return this._dockerService;
  }
}
