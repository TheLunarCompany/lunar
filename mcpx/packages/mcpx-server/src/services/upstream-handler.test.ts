import { TelemetryLogger } from "@aigw/core/logging";
import { ManualClock } from "@aigw/core/time";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import {
  ConfigService,
  DEFAULT_CONFIG,
  InMemoryConfigStore,
} from "../config.js";
import { resetEnv } from "../env.js";
import { FailedToConnectToTargetServer, TokenExpiredError } from "../errors.js";
import { TargetServer } from "../model/target-servers.js";
import { CapabilityRegistry } from "./capability-registry.js";
import { CapabilityResolver } from "./capability-resolver.js";
import { CatalogManagerI } from "./catalog-manager.js";
import { ExtendedClientI } from "./client-extension.js";
import {
  ExistingAuthVerdict,
  ExistingTokensResult,
  OAuthConnectionHandler,
} from "./oauth-connection-handler.js";
import { InMemoryServerConfigManager } from "./server-config-manager.js";
import { SystemStateTracker } from "./system-state.js";
import { TargetServerConnectionFactory } from "./target-server-connection-factory.js";
import { ToolTokenEstimator } from "./tool-token-estimator.js";
import { UpstreamHandler } from "./upstream-handler.js";

const SERVER_NAME = "gitlab";
const RECONNECT_BASE_DELAY_MS = 30_000;

const remoteServer: TargetServer = {
  type: "streamable-http",
  name: SERVER_NAME,
  url: "https://gitlab.example.com/api/v4/mcp",
};

function rateLimitError(): Error {
  return Object.assign(new Error("Streamable HTTP error: Too Many Requests"), {
    code: 429,
  });
}

function unauthorizedError(): Error {
  return Object.assign(new Error("HTTP 401: Unauthorized"), { code: 401 });
}

function connectionRefusedError(): Error {
  return new Error("connect ECONNREFUSED");
}

function clientRateLimitedOnToolsList(): ExtendedClientI {
  return fakeExtendedClient({
    listTools: async () => {
      throw rateLimitError();
    },
  });
}

function fakeExtendedClient(
  overrides: Partial<Record<keyof ExtendedClientI, unknown>> = {},
): ExtendedClientI {
  return {
    listTools: async () => ({ tools: [], toolParentNames: {} }),
    listPrompts: async () => ({ prompts: [] }),
    callTool: async () => ({ content: [] }),
    onToolsListChanged: () => () => {},
    onPromptsListChanged: () => () => {},
    close: async () => {},
    ...overrides,
  } as unknown as ExtendedClientI;
}

function recordingLogger(): {
  logger: TelemetryLogger;
  warn: jest.Mock;
} {
  const warn = jest.fn();
  const noop = jest.fn();
  const self: Record<string, unknown> = {};
  for (const level of [
    "error",
    "info",
    "http",
    "verbose",
    "debug",
    "silly",
    "log",
  ]) {
    self[level] = noop;
  }
  self["warn"] = warn;
  self["child"] = () => self;
  self["telemetry"] = self;
  return { logger: self as unknown as TelemetryLogger, warn };
}

function stubCatalog(): CatalogManagerI {
  return {
    isStrict: () => false,
    isServerApproved: () => true,
    isToolApproved: () => true,
    isPromptApproved: () => true,
    getById: () => undefined,
    getDisplayNameById: () => undefined,
    getDisplayNameByName: () => undefined,
    getCatalog: () => [],
    subscribe: () => () => {},
  } as unknown as CatalogManagerI;
}

async function setup(props: { isOAuth: boolean }) {
  const { logger, warn } = recordingLogger();
  const createConnection = jest.fn<() => Promise<ExtendedClientI>>();
  const connectionFactory = {
    createConnection,
  } as unknown as TargetServerConnectionFactory;

  const safeTryWithExistingTokens =
    jest.fn<() => Promise<ExistingTokensResult>>();
  const resolveExistingAuth = jest.fn<() => Promise<ExistingAuthVerdict>>();
  const completeOAuth = jest.fn<() => Promise<ExtendedClientI>>();
  const oauthConnectionHandler = {
    isOAuthServer: () => props.isOAuth,
    hasCatalogItemOAuth: () => false,
    hasStaticOAuthForUrl: () => false,
    isTokenExpiredForServer: async () => false,
    safeTryWithExistingTokens,
    resolveExistingAuth,
    getServerNameByState: () => SERVER_NAME,
    completeOAuth,
    completeOAuthFlowCleanup: () => {},
  } as unknown as OAuthConnectionHandler;

  const catalog = stubCatalog();
  const registry = new CapabilityRegistry(logger);
  const resolver = new CapabilityResolver(
    registry,
    catalog,
    { hasPermission: () => true },
    logger,
  );
  const handler = new UpstreamHandler(
    new SystemStateTracker(new ManualClock(), logger),
    new InMemoryServerConfigManager(),
    connectionFactory,
    oauthConnectionHandler,
    catalog,
    new ToolTokenEstimator(),
    registry,
    resolver,
    new ConfigService(
      structuredClone(DEFAULT_CONFIG),
      new InMemoryConfigStore(),
      logger,
    ),
    logger,
    {
      pingIntervalMs: 0,
      pingTimeoutMs: 1000,
      pingFailureThreshold: 3,
      reconnectBaseDelayMs: RECONNECT_BASE_DELAY_MS,
    },
  );

  await handler.initialize();

  return {
    handler,
    baselineTimers: jest.getTimerCount(),
    warn,
    createConnection,
    safeTryWithExistingTokens,
    resolveExistingAuth,
    completeOAuth,
    stateOf: (): string | undefined =>
      handler.clientsByService.get(SERVER_NAME)?._state,
    rateLimitWarnings: (): unknown[][] =>
      warn.mock.calls.filter(
        ([message]) =>
          typeof message === "string" && message.includes("rate limited"),
      ),
  };
}

describe("UpstreamHandler rate limit handling", () => {
  let handlers: UpstreamHandler[];

  beforeEach(() => {
    process.env["VERSION"] = "test-version";
    process.env["INSTANCE_ID"] = "test-instance";
    resetEnv();
    jest.useFakeTimers({
      doNotFake: ["nextTick", "setImmediate", "queueMicrotask"],
    });
    handlers = [];
  });

  afterEach(async () => {
    await Promise.all(handlers.map((handler) => handler.shutdown()));
    jest.useRealTimers();
    delete process.env["VERSION"];
    delete process.env["INSTANCE_ID"];
  });

  function track<T extends { handler: UpstreamHandler }>(harness: T): T {
    handlers.push(harness.handler);
    return harness;
  }

  describe("for an OAuth server", () => {
    it("addClient: a 429 on the first connect records pending-auth and schedules no reconnect", async () => {
      const h = track(await setup({ isOAuth: true }));
      h.createConnection.mockResolvedValue(clientRateLimitedOnToolsList());

      await h.handler.addClient(remoteServer);

      expect(h.stateOf()).toBe("pending-auth");
      expect(jest.getTimerCount()).toBe(h.baselineTimers);
    });

    it("reloadClients: a 429 on reload records pending-auth and schedules no reconnect", async () => {
      const h = track(await setup({ isOAuth: true }));
      h.createConnection.mockResolvedValueOnce(fakeExtendedClient());
      await h.handler.addClient(remoteServer);
      expect(h.stateOf()).toBe("connected");
      h.createConnection.mockResolvedValue(clientRateLimitedOnToolsList());

      await h.handler.reloadClients();

      expect(h.stateOf()).toBe("pending-auth");
      expect(jest.getTimerCount()).toBe(h.baselineTimers);
    });

    it("attemptReconnect: a 429 on a retry records pending-auth and schedules no further retry", async () => {
      const h = track(await setup({ isOAuth: true }));
      h.createConnection.mockRejectedValueOnce(connectionRefusedError());
      await h.handler.addClient(remoteServer);
      expect(h.stateOf()).toBe("connection-failed");
      expect(jest.getTimerCount()).toBe(h.baselineTimers + 1);
      h.createConnection.mockResolvedValue(clientRateLimitedOnToolsList());

      await jest.advanceTimersByTimeAsync(RECONNECT_BASE_DELAY_MS);

      expect(h.createConnection).toHaveBeenCalledTimes(2);
      expect(h.stateOf()).toBe("pending-auth");
      expect(jest.getTimerCount()).toBe(h.baselineTimers);
    });

    it("attemptReconnect: a retry that needs a login records pending-auth and ends the retry loop", async () => {
      const h = track(await setup({ isOAuth: true }));
      h.createConnection.mockRejectedValueOnce(connectionRefusedError());
      await h.handler.addClient(remoteServer);
      expect(h.stateOf()).toBe("connection-failed");
      expect(jest.getTimerCount()).toBe(h.baselineTimers + 1);
      h.createConnection.mockRejectedValue(unauthorizedError());
      h.resolveExistingAuth.mockResolvedValue({ kind: "needs-auth" });

      await jest.advanceTimersByTimeAsync(RECONNECT_BASE_DELAY_MS);

      expect(h.stateOf()).toBe("pending-auth");
      expect(jest.getTimerCount()).toBe(h.baselineTimers);

      await jest.advanceTimersByTimeAsync(RECONNECT_BASE_DELAY_MS * 8);

      expect(h.createConnection).toHaveBeenCalledTimes(2);
      expect(h.stateOf()).toBe("pending-auth");
    });

    it("runAuthRecovery: a 429 on silent re-auth records pending-auth and schedules no reconnect", async () => {
      const h = track(await setup({ isOAuth: true }));
      h.createConnection.mockResolvedValueOnce(
        fakeExtendedClient({
          callTool: async () => {
            throw unauthorizedError();
          },
        }),
      );
      await h.handler.addClient(remoteServer);
      h.safeTryWithExistingTokens.mockResolvedValue({ kind: "rate-limited" });

      await expect(
        h.handler.callTool(SERVER_NAME, { name: "whoami", arguments: {} }),
      ).rejects.toBeInstanceOf(TokenExpiredError);

      expect(h.stateOf()).toBe("pending-auth");
      expect(jest.getTimerCount()).toBe(h.baselineTimers);
    });

    it("runAuthRecovery: a 429 on tools/list after a successful silent re-auth records pending-auth and schedules no reconnect", async () => {
      const h = track(await setup({ isOAuth: true }));
      h.createConnection.mockResolvedValueOnce(
        fakeExtendedClient({
          callTool: async () => {
            throw unauthorizedError();
          },
        }),
      );
      await h.handler.addClient(remoteServer);
      h.safeTryWithExistingTokens.mockResolvedValue({
        kind: "connected",
        client: clientRateLimitedOnToolsList(),
      });

      await expect(
        h.handler.callTool(SERVER_NAME, { name: "whoami", arguments: {} }),
      ).rejects.toBeInstanceOf(TokenExpiredError);

      expect(h.stateOf()).toBe("pending-auth");
      expect(jest.getTimerCount()).toBe(h.baselineTimers);
    });

    it("completeOAuth: a 429 on tools/list right after the login records pending-auth and schedules no reconnect", async () => {
      const h = track(await setup({ isOAuth: true }));
      h.createConnection.mockRejectedValue(unauthorizedError());
      h.resolveExistingAuth.mockResolvedValue({ kind: "needs-auth" });
      await h.handler.addClient(remoteServer);
      expect(h.stateOf()).toBe("pending-auth");
      h.completeOAuth.mockResolvedValue(clientRateLimitedOnToolsList());

      await h.handler.completeOAuthByState("state", "code");

      expect(h.stateOf()).toBe("pending-auth");
      expect(jest.getTimerCount()).toBe(h.baselineTimers);
      expect(h.rateLimitWarnings()).toHaveLength(1);
    });

    it("existing-auth verdict: rate-limited records pending-auth and schedules no reconnect", async () => {
      const h = track(await setup({ isOAuth: true }));
      h.createConnection.mockRejectedValue(unauthorizedError());
      h.resolveExistingAuth.mockResolvedValue({ kind: "rate-limited" });

      await h.handler.addClient(remoteServer);

      expect(h.stateOf()).toBe("pending-auth");
      expect(jest.getTimerCount()).toBe(h.baselineTimers);
    });

    it("reuseOAuthByName: a 429 rejects and leaves the server pending-auth", async () => {
      const h = track(await setup({ isOAuth: true }));
      h.createConnection.mockRejectedValue(unauthorizedError());
      h.resolveExistingAuth.mockResolvedValue({ kind: "needs-auth" });
      await h.handler.addClient(remoteServer);
      expect(h.stateOf()).toBe("pending-auth");
      h.safeTryWithExistingTokens.mockResolvedValue({ kind: "rate-limited" });

      await expect(
        h.handler.reuseOAuthByName(SERVER_NAME),
      ).rejects.toBeInstanceOf(FailedToConnectToTargetServer);

      expect(h.stateOf()).toBe("pending-auth");
      expect(jest.getTimerCount()).toBe(h.baselineTimers);
    });

    it("keeps the unreachable verdict on the backoff", async () => {
      const h = track(await setup({ isOAuth: true }));
      h.createConnection.mockRejectedValue(unauthorizedError());
      h.resolveExistingAuth.mockResolvedValue({ kind: "unreachable" });

      await h.handler.addClient(remoteServer);

      expect(h.stateOf()).toBe("connection-failed");
      expect(jest.getTimerCount()).toBe(h.baselineTimers + 1);
    });

    it("logs one warning per transition with the server, status, attempts and the wait for login", async () => {
      const h = track(await setup({ isOAuth: true }));
      h.createConnection.mockResolvedValue(clientRateLimitedOnToolsList());

      await h.handler.addClient(remoteServer);

      expect(h.rateLimitWarnings()).toEqual([
        [
          "Upstream server rate limited the connection, waiting for user login",
          { name: SERVER_NAME, status: 429, attempts: 0 },
        ],
      ]);
    });

    it("logs one warning when the verdict switch handles the 429", async () => {
      const h = track(await setup({ isOAuth: true }));
      h.createConnection.mockRejectedValue(unauthorizedError());
      h.resolveExistingAuth.mockResolvedValue({ kind: "rate-limited" });

      await h.handler.addClient(remoteServer);

      expect(h.rateLimitWarnings()).toHaveLength(1);
    });
  });

  describe("for a non-OAuth server", () => {
    it("addClient: a 429 stays connection-failed and schedules a reconnect with backoff", async () => {
      const h = track(await setup({ isOAuth: false }));
      h.createConnection.mockResolvedValue(clientRateLimitedOnToolsList());

      await h.handler.addClient(remoteServer);

      expect(h.stateOf()).toBe("connection-failed");
      expect(jest.getTimerCount()).toBe(h.baselineTimers + 1);
      expect(h.rateLimitWarnings()).toEqual([]);
    });

    it("keeps retrying with a doubling delay", async () => {
      const h = track(await setup({ isOAuth: false }));
      h.createConnection.mockResolvedValue(clientRateLimitedOnToolsList());
      await h.handler.addClient(remoteServer);

      await jest.advanceTimersByTimeAsync(RECONNECT_BASE_DELAY_MS);
      expect(h.createConnection).toHaveBeenCalledTimes(2);
      expect(h.stateOf()).toBe("connection-failed");

      await jest.advanceTimersByTimeAsync(RECONNECT_BASE_DELAY_MS);
      expect(h.createConnection).toHaveBeenCalledTimes(2);

      await jest.advanceTimersByTimeAsync(RECONNECT_BASE_DELAY_MS);
      expect(h.createConnection).toHaveBeenCalledTimes(3);
      expect(jest.getTimerCount()).toBe(h.baselineTimers + 1);
    });
  });
});
