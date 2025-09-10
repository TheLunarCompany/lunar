import { systemClock } from "@mcpx/toolkit-core/time";
import { MeterProvider } from "@opentelemetry/sdk-metrics";
import path from "path";
import { LunarLogger } from "@mcpx/toolkit-core/logging";
import { ConfigService } from "../config.js";
import { env } from "../env.js";
import {
  OAuthSessionManager,
  OAuthSessionManagerI,
} from "../server/oauth-session-manager.js";
import { ExtendedClientBuilder } from "./client-extension.js";
import { ControlPlaneService } from "./control-plane-service.js";
import { DockerService } from "./docker.js";
import { MetricRecorder } from "./metrics.js";
import { OAuthConnectionHandler } from "./oauth-connection-handler.js";
import { PermissionManager } from "./permissions.js";
import { ServerConfigManager } from "./server-config-manager.js";
import { SessionsManager } from "./sessions.js";
import { SystemStateTracker } from "./system-state.js";
import { TargetClients } from "./target-clients.js";
import { TargetServerConnectionFactory } from "./target-server-connection-factory.js";
import { ConfigValidator } from "./config-validator.js";
import { AuditLogService } from "./audit-log/audit-log-service.js";
import { FileAuditLogPersistence } from "./audit-log/audit-log-persistence.js";
import { HubService } from "./hub.js";

export class Services {
  private _sessions: SessionsManager;
  private _targetClients: TargetClients;
  private _permissionManager: PermissionManager;
  private _systemStateTracker: SystemStateTracker;
  private _controlPlane: ControlPlaneService;
  private _metricsRecord: MetricRecorder;
  private _dockerService: DockerService;
  private _oauthSessionManager: OAuthSessionManagerI;
  private _hubService: HubService;
  private _config: ConfigService;
  private _auditLogService: AuditLogService;
  private logger: LunarLogger;
  private initialized = false;

  constructor(
    config: ConfigService,
    meterProvider: MeterProvider,
    logger: LunarLogger,
  ) {
    this._config = config;

    const systemStateTracker = new SystemStateTracker(systemClock, logger);
    this._systemStateTracker = systemStateTracker;

    const extendedClientBuilder = new ExtendedClientBuilder(config);
    this._dockerService = new DockerService(
      env.MITM_PROXY_CA_CERT_PATH,
      logger,
    );

    const oauthSessionManager = new OAuthSessionManager(
      logger.child({ component: "OAuthSessionManager" }),
      config.getConfig().staticOauth,
    );
    this._oauthSessionManager = oauthSessionManager;

    const serverConfigManager = new ServerConfigManager(
      path.resolve(env.SERVERS_CONFIG_PATH),
      logger.child({ component: "ServerConfigManager" }),
    );

    const oauthConnectionHandler = new OAuthConnectionHandler(
      oauthSessionManager,
      extendedClientBuilder,
      logger.child({ component: "OAuthConnectionHandler" }),
    );

    const connectionFactory = new TargetServerConnectionFactory(
      extendedClientBuilder,
      this._dockerService,
      logger.child({ component: "ConnectionFactory" }),
    );

    const targetClients = new TargetClients(
      this._systemStateTracker,
      serverConfigManager,
      connectionFactory,
      oauthConnectionHandler,
      logger,
    );
    this._targetClients = targetClients;

    const sessionsManager = new SessionsManager(systemStateTracker, logger);
    this._sessions = sessionsManager;

    this._permissionManager = new PermissionManager(logger);

    this._metricsRecord = new MetricRecorder(meterProvider);

    this._hubService = new HubService(logger);

    this._controlPlane = new ControlPlaneService(
      systemStateTracker,
      targetClients,
      config,
      logger,
    );

    const auditLogPersistence = new FileAuditLogPersistence(
      env.AUDIT_LOG_DIR,
      env.AUDIT_LOG_RETENTION_HOURS,
      systemClock,
      logger.child({ component: "AuditLogPersistence" }),
    );

    this._auditLogService = new AuditLogService(
      systemClock,
      logger.child({ component: "AuditLogService" }),
      auditLogPersistence,
    );

    this.logger = logger;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    this._config.registerConsumer(this._permissionManager);
    this._config.registerConsumer(new ConfigValidator());

    await this._targetClients.initialize();
    await this._config.initialize();

    // Set up audit logging for config changes
    this.setupAuditLogging();

    this._hubService.addStatusListener((status) => {
      this.logger.debug("Hub connection status changed", status);
    });

    await this._hubService.initialize();
    this.initialized = true;
  }

  private setupAuditLogging(): void {
    // Subscribe to config changes to audit log them
    this._config.subscribe(async (snapshot) => {
      this._auditLogService.log({
        eventType: "config_applied",
        payload: snapshot,
      });
    });
  }

  async shutdown(): Promise<void> {
    this.logger.info("Shutting down services...");

    // Close all sessions
    await this._sessions.shutdown();

    // Shutdown target clients
    await this._targetClients.shutdown();

    // Shutdown audit log service
    await this._auditLogService.shutdown();

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

  get oauthSessionManager(): OAuthSessionManagerI {
    this.ensureInitialized();
    return this._oauthSessionManager;
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

  get auditLog(): AuditLogService {
    this.ensureInitialized();
    return this._auditLogService;
  }

  get hubService(): HubService {
    this.ensureInitialized();
    return this._hubService;
  }
}
