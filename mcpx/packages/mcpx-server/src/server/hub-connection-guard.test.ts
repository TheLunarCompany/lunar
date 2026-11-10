import { checkHubConnection } from "./hub-connection-guard.js";
import { HubService, HubConnectionError } from "../services/hub.js";

describe("checkHubConnection", () => {
  const createMockHubService = (
    status: "authenticated" | "unauthenticated",
    connectionError?: HubConnectionError,
  ): HubService =>
    ({
      status: { status, connectionError },
    }) as unknown as HubService;

  describe("when enforceConnection is false", () => {
    it("should allow connection regardless of hub status", () => {
      const hubService = createMockHubService("unauthenticated");

      const result = checkHubConnection(hubService, false);

      expect(result).toEqual({ allowed: true });
    });
  });

  describe("when enforceConnection is true", () => {
    it("should allow connection when hub is authenticated", () => {
      const hubService = createMockHubService("authenticated");

      const result = checkHubConnection(hubService, true);

      expect(result).toEqual({ allowed: true });
    });

    it("should reject connection when hub is unauthenticated", () => {
      const hubService = createMockHubService("unauthenticated");

      const result = checkHubConnection(hubService, true);

      expect(result).toEqual({
        allowed: false,
        status: "unauthenticated",
        connectionError: undefined,
      });
    });

    it("should include connection error when present", () => {
      const connectionError = new HubConnectionError("Hub is unavailable");
      const hubService = createMockHubService(
        "unauthenticated",
        connectionError,
      );

      const result = checkHubConnection(hubService, true);

      expect(result).toEqual({
        allowed: false,
        status: "unauthenticated",
        connectionError,
      });
    });
  });
});
