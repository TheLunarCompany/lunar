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
import { MetricRecorder } from "./metrics.js";
import { OAuthConnectionHandler } from "./oauth-connection-handler.js";
import { PermissionManager } from "./permissions.js";
import {
  FileServerConfigManager,
  InMemoryServerConfigManager,
  ServerConfigManager,
} from "./server-config-manager.js";
import { SessionsManager } from "./sessions.js";
import { SystemStateTracker } from "./system-state.js";
import { UpstreamHandler } from "./upstream-handler.js";
import { TargetServerConnectionFactory } from "./target-server-connection-factory.js";
import { ConfigValidator } from "./config-validator.js";
import { AuditLogService } from "./audit-log/audit-log-service.js";
import { FileAuditLogPersistence } from "./audit-log/audit-log-persistence.js";
import { diffConfigForAudit } from "./audit-log/audit-log-diff.js";
import { HubService } from "./hub.js";
import { UIConnections } from "./connections.js";
import { SetupManager } from "./setup-manager.js";
import { CatalogManager } from "./catalog-manager.js";
import { IdentityService } from "./identity-service.js";
import { EnvVarManager } from "./env-var-manager.js";
import { WebappBoundPayloadOf } from "@mcpx/webapp-protocol/messages";
import { buildUsageStatsPayload } from "./usage-stats-sender.js";
import { ToolTokenEstimator } from "./tool-token-estimator.js";
import {
  DynamicCapabilitiesService,
  createLLMService,
} from "../internal-tools/index.js";
import { OAuthToolsService } from "./oauth-tools.js";
import {
  InternalCapabilitiesService,
  wireInternalCapabilityProvider,
} from "./internal-capabilities-service.js";
import { OAuthTokenStoreI } from "./oauth-token-store.js";
import { DiskTokenStore } from "./disk-token-store.js";
import { HubTokenClient } from "./hub-token-client.js";
import { HubDownstreamSessionClient } from "./hub-downstream-session-client.js";
import { CapabilityRegistry } from "./capability-registry.js";
import { CapabilityResolver } from "./capability-resolver.js";

export interface ServicesOptions {
  hubUrl?: string;
}

export class Services {
  private _sessions: SessionsManager;
  private _upstreamHandler: UpstreamHandler;
  private _permissionManager: PermissionManager;
  private _systemStateTracker: SystemStateTracker;
  private _controlPlane: ControlPlaneService;
  private _metricsRecord: MetricRecorder;
  private _hubService: HubService;
  private _config: ConfigService;
  private _auditLogService: AuditLogService;
  private _connections: UIConnections;
  private _setupManager: SetupManager;
  private _catalogManager: CatalogManager;
  private _identityService: IdentityService;
  private _envVarManager: EnvVarManager;
  private _dynamicCapabilities: DynamicCapabilitiesService;
  private _oauthTools: OAuthToolsService;
  private _oauthSessionManager: OAuthSessionManager;
  private _capabilityRegistry: CapabilityRegistry;
  private _capabilityResolver: CapabilityResolver;
  private _internalCapabilities: InternalCapabilitiesService;

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

    this._envVarManager = new EnvVarManager(logger);

    this._catalogManager = new CatalogManager(
      logger,
      this._identityService,
      this._envVarManager,
      env.STRICTNESS_REQUIRED,
    );

    const extendedClientBuilder = new ExtendedClientBuilder(config, logger);

    const hubTokenStore: OAuthTokenStoreI = env.IS_ENTERPRISE
      ? new HubTokenClient(() => this._hubService.getSocketAdapter(), logger)
      : new DiskTokenStore(path.join(process.cwd(), ".mcpx", "tokens"), logger);

    this._oauthSessionManager = new OAuthSessionManager(
      logger.child({ component: "OAuthSessionManager" }),
      hubTokenStore,
      this._envVarManager,
      config.getConfig().staticOauth,
    );
    const oauthSessionManager = this._oauthSessionManager;

    const serverConfigManager: ServerConfigManager = env.IS_ENTERPRISE
      ? new InMemoryServerConfigManager()
      : new FileServerConfigManager(
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
      logger.child({ component: "ConnectionFactory" }),
      this._identityService,
      this._envVarManager,
    );

    startupLogger.info("Loading tokenizer...");
    const toolTokenEstimator = new ToolTokenEstimator(
      getEncoding(env.TOKENIZER_ENCODING),
    );
    startupLogger.info("Tokenizer loaded");

    const capabilityRegistry = new CapabilityRegistry(logger);
    this._capabilityRegistry = capabilityRegistry;

    // Constructed before the resolver, which injects it.
    this._permissionManager = new PermissionManager(logger);

    const capabilityResolver = new CapabilityResolver(
      capabilityRegistry,
      this._catalogManager,
      this._permissionManager,
      logger,
    );
    this._capabilityResolver = capabilityResolver;

    const upstreamHandler = new UpstreamHandler(
      this._systemStateTracker,
      serverConfigManager,
      connectionFactory,
      oauthConnectionHandler,
      this._catalogManager,
      toolTokenEstimator,
      capabilityRegistry,
      capabilityResolver,
      config,
      logger,
      {
        pingIntervalMs: env.UPSTREAM_PING_INTERVAL_MS,
        pingTimeoutMs: env.UPSTREAM_PING_TIMEOUT_MS,
        reconnectBaseDelayMs: env.UPSTREAM_RECONNECT_BASE_DELAY_MS,
      },
    );
    this._upstreamHandler = upstreamHandler;

    this._setupManager = new SetupManager(upstreamHandler, config, logger);

    function extractUsageStats(): WebappBoundPayloadOf<"usage-stats"> {
      const systemState = systemStateTracker.export();
      return buildUsageStatsPayload(systemState);
    }

    this._hubService = new HubService(
      logger,
      this._setupManager,
      this._catalogManager,
      this._envVarManager,
      config,
      this._identityService,
      upstreamHandler,
      extractUsageStats,
      {
        hubUrl: options.hubUrl,
        connectionTimeout: env.HUB_CONNECTION_TIMEOUT_MS,
        reconnectionDelayMax: env.HUB_RECONNECT_DELAY_MAX_MS,
      },
    );

    const downstreamSessionStore = new HubDownstreamSessionClient(
      () => this._hubService.getSocketAdapter(),
      logger,
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
      downstreamSessionStore,
    );
    this._sessions = sessionsManager;

    this._metricsRecord = new MetricRecorder(meterProvider, () =>
      this._identityService.getDisplayName(),
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

    this._controlPlane = new ControlPlaneService(
      systemStateTracker,
      upstreamHandler,
      config,
      this._auditLogService,
      logger,
    );

    this._connections = new UIConnections(logger);

    const llmService = createLLMService({
      isEnterprise: env.IS_ENTERPRISE,
      hubService: this._hubService,
      logger,
    });
    this._dynamicCapabilities = new DynamicCapabilitiesService(
      this._controlPlane.config,
      llmService,
      capabilityResolver,
      logger,
    );

    this._oauthTools = new OAuthToolsService(
      this._upstreamHandler,
      this._permissionManager,
      `${env.MCPX_SERVER_URL}/auth/callback`,
    );

    this._internalCapabilities = new InternalCapabilitiesService(logger);
    wireInternalCapabilityProvider(
      this._oauthTools,
      this._internalCapabilities,
      capabilityRegistry,
    );
    wireInternalCapabilityProvider(
      this._dynamicCapabilities,
      this._internalCapabilities,
      capabilityRegistry,
    );

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
    this._config.registerConsumer(new ConfigValidator(this._envVarManager));
    this._config.registerConsumer(this._oauthSessionManager);

    startupLogger.info("Initializing UpstreamHandler...");
    await this._upstreamHandler.initialize();
    startupLogger.info("UpstreamHandler initialized");

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

    startupLogger.info("Initializing DynamicCapabilitiesService...");
    await this._dynamicCapabilities.initialize();
    startupLogger.info("DynamicCapabilitiesService initialized");

    startupLogger.info("Initializing SessionsManager...");
    await this._sessions.initialize();
    startupLogger.info("SessionsManager initialized");
    this.bindClientNotificationListeners();

    this.initialized = true;
    startupLogger.info("All services initialized");
  }

  private setupAuditLogging(): void {
    this._config.subscribe((snapshot, { prevConfig }) => {
      if (prevConfig === undefined) return;
      for (const event of diffConfigForAudit({
        prev: prevConfig,
        next: snapshot.config,
      })) {
        this._auditLogService.log(event);
      }
    });

    this._catalogManager.subscribe((change) => {
      const { addedServers, removedServers, approvedToolsChanges } = change;
      if (
        addedServers.length === 0 &&
        removedServers.length === 0 &&
        approvedToolsChanges.length === 0
      ) {
        return;
      }
      this._auditLogService.log({
        eventType: "catalog_updated",
        payload: { addedServers, removedServers, approvedToolsChanges },
      });
    });
  }

  private bindClientNotificationListeners(): void {
    // Two schedulers on purpose: client broadcasts debounce (~200ms) so churn
    // coalesces; system-state sync uses microtasks so the admin UI converges
    // near-instantly.
    this._capabilityResolver.onChanged((kind) => {
      this._upstreamHandler.syncSystemStateWithApprovals();
      this._sessions.scheduleBroadcastListChanged(kind);
    });

    this._config.subscribe(({ config }) => {
      const inactiveNames = new Set(
        Object.entries(config.targetServerAttributes)
          .filter(([, { inactive }]) => inactive)
          .map(([name]) => name),
      );
      this._capabilityResolver.setInactiveServers(inactiveNames);
      // Permission/visibility config changes don't move the resolver's active
      // set (permissions are applied per-consumer at read time), so they never
      // reach the onChanged path above. Re-broadcast every exposed kind here so
      // clients re-list.
      this._sessions.scheduleBroadcastAllListChanged();
    });
  }

  async shutdown(): Promise<void> {
    this.logger.info("Shutting down services...");

    this._capabilityResolver.shutdown();
    this._capabilityRegistry.shutdown();

    await this._upstreamHandler.shutdown();
    await this._sessions.shutdown();

    // Close all connections (including UI socket)
    this._connections.shutdown();

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
  get upstreamHandler(): UpstreamHandler {
    this.ensureInitialized();
    return this._upstreamHandler;
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

  get envVarManager(): EnvVarManager {
    this.ensureInitialized();
    return this._envVarManager;
  }

  get dynamicCapabilities(): DynamicCapabilitiesService {
    this.ensureInitialized();
    return this._dynamicCapabilities;
  }

  get oauthTools(): OAuthToolsService {
    this.ensureInitialized();
    return this._oauthTools;
  }

  get internalCapabilities(): InternalCapabilitiesService {
    this.ensureInitialized();
    return this._internalCapabilities;
  }

  get capabilityRegistry(): CapabilityRegistry {
    this.ensureInitialized();
    return this._capabilityRegistry;
  }

  get capabilityResolver(): CapabilityResolver {
    this.ensureInitialized();
    return this._capabilityResolver;
  }
}
