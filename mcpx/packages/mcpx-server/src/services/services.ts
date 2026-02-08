import { systemClock } from "@mcpx/toolkit-core/time";
import { MeterProvider } from "@opentelemetry/sdk-metrics";
import path from "path";
import { getEncoding } from "js-tiktoken";
import { LunarLogger } from "@mcpx/toolkit-core/logging";
import { ConfigService } from "../config.js";
import { env } from "../env.js";
import { OAuthSessionManager } from "../server/oauth-session-manager.js";
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
import { UIConnections } from "./connections.js";
import { SetupManager } from "./setup-manager.js";
import { CatalogManager } from "./catalog-manager.js";
import { IdentityService } from "./identity-service.js";
import { WebappBoundPayloadOf } from "@mcpx/webapp-protocol/messages";
import { buildUsageStatsPayload } from "./usage-stats-sender.js";
import { ToolTokenEstimator } from "./tool-token-estimator.js";

export interface ServicesOptions {
  hubUrl?: string;
}

export class Services {
  private _sessions: SessionsManager;
  private _targetClients: TargetClients;
  private _permissionManager: PermissionManager;
  private _systemStateTracker: SystemStateTracker;
  private _controlPlane: ControlPlaneService;
  private _metricsRecord: MetricRecorder;
  private _dockerService: DockerService;
  private _hubService: HubService;
  private _config: ConfigService;
  private _auditLogService: AuditLogService;
  private _connections: UIConnections;
  private _setupManager: SetupManager;
  private _catalogManager: CatalogManager;
  private _identityService: IdentityService;

  private logger: LunarLogger;
  private initialized = false;

  constructor(
    config: ConfigService,
    meterProvider: MeterProvider,
    logger: LunarLogger,
    options: ServicesOptions = {},
  ) {
    this._config = config;
    const startupLogger = logger.child({ component: "Services" });

    startupLogger.info("Constructing services...");

    const systemStateTracker = new SystemStateTracker(systemClock, logger);
    this._systemStateTracker = systemStateTracker;

    this._identityService = new IdentityService(logger, {
      isEnterprise: env.IS_ENTERPRISE,
    });

    this._catalogManager = new CatalogManager(
      logger,
      this._identityService,
      env.STRICTNESS_REQUIRED,
    );

    const extendedClientBuilder = new ExtendedClientBuilder(
      config,
      this._catalogManager,
    );
    this._dockerService = new DockerService(
      env.MITM_PROXY_CA_CERT_PATH,
      logger,
    );

    const oauthSessionManager = new OAuthSessionManager(
      logger.child({ component: "OAuthSessionManager" }),
      config.getConfig().staticOauth,
    );

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
      this._identityService,
    );

    startupLogger.info("Loading tokenizer...");
    const toolTokenEstimator = new ToolTokenEstimator(
      getEncoding(env.TOKENIZER_ENCODING),
    );
    startupLogger.info("Tokenizer loaded");

    const targetClients = new TargetClients(
      this._systemStateTracker,
      serverConfigManager,
      connectionFactory,
      oauthConnectionHandler,
      this._catalogManager,
      toolTokenEstimator,
      logger,
    );
    this._targetClients = targetClients;

    this._setupManager = new SetupManager(targetClients, config, logger);

    function extractUsageStats(): WebappBoundPayloadOf<"usage-stats"> {
      const systemState = systemStateTracker.export();
      return buildUsageStatsPayload(systemState);
    }

    this._hubService = new HubService(
      logger,
      this._setupManager,
      this._catalogManager,
      config,
      this._identityService,
      targetClients,
      extractUsageStats,
      { hubUrl: options.hubUrl },
    );

    const sessionsManager = new SessionsManager(
      {
        pingIntervalMs: env.PING_INTERVAL_MS,
        probeClientsGraceLivenessPeriodMs:
          env.PROBE_CLIENTS_GRACE_LIVENESS_PERIOD_MS,
        sessionTtlMin: env.AGENT_SESSION_TTL_MIN,
        sessionSweepIntervalMin: env.KEEPALIVE_SWEEP_INTERVAL_MIN,
      },
      systemStateTracker,
      logger,
      systemClock,
    );
    this._sessions = sessionsManager;

    this._permissionManager = new PermissionManager(logger);

    this._metricsRecord = new MetricRecorder(meterProvider);

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

    this._connections = new UIConnections(logger);

    this.logger = logger;
    startupLogger.info("Services constructed");
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    const startupLogger = this.logger.child({ component: "Services" });
    startupLogger.info("Initializing services...");

    this._config.registerConsumer(this._permissionManager);
    this._config.registerConsumer(new ConfigValidator());

    startupLogger.info("Initializing TargetClients...");
    await this._targetClients.initialize();
    startupLogger.info("TargetClients initialized");

    startupLogger.info("Initializing ConfigService...");
    await this._config.initialize();
    startupLogger.info("ConfigService initialized");

    this.setupAuditLogging();

    this._hubService.addStatusListener((status) => {
      this.logger.debug("Hub connection status changed", status);
    });

    startupLogger.info("Initializing HubService...");
    await this._hubService.initialize();
    startupLogger.info("HubService initialized");

    startupLogger.info("Initializing SessionsManager...");
    await this._sessions.initialize();
    startupLogger.info("SessionsManager initialized");

    this.initialized = true;
    startupLogger.info("All services initialized");
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

    await this._sessions.shutdown();

    // Close all connections (including UI socket)
    this._connections.shutdown();

    // Shutdown target clients
    await this._targetClients.shutdown();

    // Shutdown audit log service
    await this._auditLogService.shutdown();

    // Disconnect from Hub
    await this._hubService.shutdown();

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

  get auditLog(): AuditLogService {
    this.ensureInitialized();
    return this._auditLogService;
  }

  get hubService(): HubService {
    this.ensureInitialized();
    return this._hubService;
  }

  get connections(): UIConnections {
    this.ensureInitialized();
    return this._connections;
  }

  get setupManager(): SetupManager {
    this.ensureInitialized();
    return this._setupManager;
  }

  get catalogManager(): CatalogManager {
    this.ensureInitialized();
    return this._catalogManager;
  }

  get identityService(): IdentityService {
    this.ensureInitialized();
    return this._identityService;
  }

  get config(): ConfigService {
    this.ensureInitialized();
    return this._config;
  }
}
