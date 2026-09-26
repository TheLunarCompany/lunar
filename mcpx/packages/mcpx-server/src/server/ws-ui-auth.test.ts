import { checkSocketAuth } from "./auth.js";
import { redactConfigSecrets } from "../services/redact.js";
import { Logger } from "winston";

describe("WebSocket UI Authentication & Config Redaction", () => {
  const dummyLogger = {
    warn: () => {},
    info: () => {},
    debug: () => {},
    error: () => {},
  } as unknown as Logger;

  describe("checkSocketAuth", () => {
    it("allows connection when auth is disabled", () => {
      const mockConfig: any = {
        getConfig: () => ({ auth: { enabled: false } }),
      };
      const result = checkSocketAuth(
        mockConfig,
        dummyLogger,
        "expected-secret",
        {},
        {},
      );
      expect(result.allowed).toBe(true);
    });

    it("allows connection when no apiKey is configured", () => {
      const mockConfig: any = {
        getConfig: () => ({ auth: { enabled: true } }),
      };
      const result = checkSocketAuth(mockConfig, dummyLogger, undefined, {}, {});
      expect(result.allowed).toBe(true);
    });

    it("rejects connection when API key is missing", () => {
      const mockConfig: any = {
        getConfig: () => ({ auth: { enabled: true } }),
      };
      const result = checkSocketAuth(
        mockConfig,
        dummyLogger,
        "expected-secret",
        {},
        {},
      );
      expect(result.allowed).toBe(false);
      expect(result.error).toBe("Unauthorized: API key required");
    });

    it("rejects connection when API key is invalid", () => {
      const mockConfig: any = {
        getConfig: () => ({ auth: { enabled: true } }),
      };
      const result = checkSocketAuth(
        mockConfig,
        dummyLogger,
        "expected-secret",
        { "x-lunar-api-key": "wrong-key" },
        {},
      );
      expect(result.allowed).toBe(false);
      expect(result.error).toBe("Forbidden: Invalid API key");
    });

    it("allows connection with valid header", () => {
      const mockConfig: any = {
        getConfig: () => ({ auth: { enabled: true } }),
      };
      const result = checkSocketAuth(
        mockConfig,
        dummyLogger,
        "expected-secret",
        { "x-lunar-api-key": "expected-secret" },
        {},
      );
      expect(result.allowed).toBe(true);
    });

    it("allows connection with valid handshake auth token", () => {
      const mockConfig: any = {
        getConfig: () => ({ auth: { enabled: true } }),
      };
      const result = checkSocketAuth(
        mockConfig,
        dummyLogger,
        "expected-secret",
        {},
        { token: "expected-secret" },
      );
      expect(result.allowed).toBe(true);
    });
  });

  describe("redactConfigSecrets", () => {
    it("redacts literal clientSecret from config objects", () => {
      const config = {
        staticOauth: {
          providers: {
            myProvider: {
              authMethod: "client_credentials",
              credentials: {
                clientId: { type: "literal", value: "client-id-123" },
                clientSecret: { type: "literal", value: "super-secret-value" },
              },
            },
          },
        },
      };

      const redacted = redactConfigSecrets(config);
      expect(
        redacted.staticOauth.providers.myProvider.credentials.clientSecret.value,
      ).toBe("[REDACTED]");
      expect(
        redacted.staticOauth.providers.myProvider.credentials.clientId.value,
      ).toBe("client-id-123");
    });
  });
});
