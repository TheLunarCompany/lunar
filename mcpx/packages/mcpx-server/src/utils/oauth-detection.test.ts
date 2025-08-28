import { noOpLogger } from "@mcpx/toolkit-core/logging";
import { RemoteTargetServer } from "../model/target-servers.js";
import { detectOAuthSupport, FetchFn } from "./oauth-detection.js";

const DEFAULT_TIMEOUT_MILLIS = 3000;

describe("checkOAuthSupport", () => {
  const mockTargetServer: RemoteTargetServer = {
    name: "test-server",
    type: "sse",
    url: "https://test.example.com/mcp",
  };

  // Mock fetch function to simulate different responses without network calls
  const createMockFetch = (
    responses: Record<string, { status: number; body?: unknown }>,
  ): FetchFn => {
    return async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = input.toString();
      const response = responses[url];

      if (!response) {
        return {
          ok: false,
          status: 404,
          json: async () => {
            throw new Error("Not found");
          },
        } as unknown as Response;
      }

      return {
        ok: response.status >= 200 && response.status < 300,
        status: response.status,
        json: async () => response.body,
      } as unknown as Response;
    };
  };

  it("should detect OAuth when both protected resource and auth server endpoints are valid", async () => {
    const mockFetch = createMockFetch({
      "https://test.example.com/.well-known/oauth-protected-resource": {
        status: 200,
        body: {
          authorization_servers: ["https://auth.example.com"],
        },
      },
      "https://test.example.com/.well-known/oauth-authorization-server": {
        status: 200,
        body: {
          authorization_endpoint: "https://auth.example.com/authorize",
          token_endpoint: "https://auth.example.com/token",
        },
      },
    });

    const result = await detectOAuthSupport(
      mockTargetServer,
      DEFAULT_TIMEOUT_MILLIS,
      noOpLogger,
      mockFetch,
    );

    expect(result).toBe(true);
  });

  it("should detect OAuth when only protected resource endpoint is valid", async () => {
    const mockFetch = createMockFetch({
      "https://test.example.com/.well-known/oauth-protected-resource": {
        status: 200,
        body: {
          authorization_servers: ["https://auth.example.com"],
        },
      },
      "https://test.example.com/.well-known/oauth-authorization-server": {
        status: 404,
      },
    });

    const result = await detectOAuthSupport(
      mockTargetServer,
      DEFAULT_TIMEOUT_MILLIS,
      noOpLogger,
      mockFetch,
    );

    expect(result).toBe(true);
  });

  it("should detect OAuth when only auth server endpoint is valid", async () => {
    const mockFetch = createMockFetch({
      "https://test.example.com/.well-known/oauth-protected-resource": {
        status: 404,
      },
      "https://test.example.com/.well-known/oauth-authorization-server": {
        status: 200,
        body: {
          authorization_endpoint: "https://auth.example.com/authorize",
          token_endpoint: "https://auth.example.com/token",
        },
      },
    });

    const result = await detectOAuthSupport(
      mockTargetServer,
      DEFAULT_TIMEOUT_MILLIS,
      noOpLogger,
      mockFetch,
    );

    expect(result).toBe(true);
  });

  it("should not detect OAuth when both endpoints return 404", async () => {
    const mockFetch = createMockFetch({
      "https://test.example.com/.well-known/oauth-protected-resource": {
        status: 404,
      },
      "https://test.example.com/.well-known/oauth-authorization-server": {
        status: 404,
      },
    });

    const result = await detectOAuthSupport(
      mockTargetServer,
      DEFAULT_TIMEOUT_MILLIS,
      noOpLogger,
      mockFetch,
    );

    expect(result).toBe(false);
  });

  it("should detect OAuth when protected resource schema is invalid but auth server is valid", async () => {
    const mockFetch = createMockFetch({
      "https://test.example.com/.well-known/oauth-protected-resource": {
        status: 200,
        body: {
          // Missing authorization_servers field, thus invalid
          some_other_field: "value",
        },
      },
      "https://test.example.com/.well-known/oauth-authorization-server": {
        status: 200,
        body: {
          // Contrary, that's a valid auth server schema
          authorization_endpoint: "https://auth.example.com/authorize",
        },
      },
    });

    const result = await detectOAuthSupport(
      mockTargetServer,
      DEFAULT_TIMEOUT_MILLIS,
      noOpLogger,
      mockFetch,
    );

    expect(result).toBe(true); // Should still be true because auth server is valid
  });

  it("should detect OAuth when auth server schema is invalid but protected resource is valid", async () => {
    const mockFetch = createMockFetch({
      "https://test.example.com/.well-known/oauth-protected-resource": {
        status: 200,
        body: {
          // Valid protected resource schema
          authorization_servers: ["https://auth.example.com"],
        },
      },
      "https://test.example.com/.well-known/oauth-authorization-server": {
        status: 200,
        body: {
          // Missing both authorization_endpoint and token_endpoint
          some_other_field: "value",
        },
      },
    });

    const result = await detectOAuthSupport(
      mockTargetServer,
      DEFAULT_TIMEOUT_MILLIS,
      noOpLogger,
      mockFetch,
    );

    expect(result).toBe(true); // Should still be true because protected resource is valid
  });

  it("should not detect OAuth when both endpoints return data but neither matches schema", async () => {
    const mockFetch = createMockFetch({
      "https://test.example.com/.well-known/oauth-protected-resource": {
        status: 200,
        body: {
          // Missing authorization_servers or empty array
          authorization_servers: [],
        },
      },
      "https://test.example.com/.well-known/oauth-authorization-server": {
        status: 200,
        body: {
          // Missing both authorization_endpoint and token_endpoint
          some_other_field: "value",
        },
      },
    });

    const result = await detectOAuthSupport(
      mockTargetServer,
      DEFAULT_TIMEOUT_MILLIS,
      noOpLogger,
      mockFetch,
    );

    expect(result).toBe(false);
  });

  it("should handle network errors gracefully", async () => {
    const mockFetch: FetchFn = async () => {
      throw new Error("Network error");
    };

    const result = await detectOAuthSupport(
      mockTargetServer,
      DEFAULT_TIMEOUT_MILLIS,
      noOpLogger,
      mockFetch,
    );

    expect(result).toBe(false);
  });

  it("should handle JSON parsing errors gracefully", async () => {
    const mockFetch: FetchFn = async () => {
      return {
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      } as unknown as Response;
    };

    const result = await detectOAuthSupport(
      mockTargetServer,
      DEFAULT_TIMEOUT_MILLIS,
      noOpLogger,
      mockFetch,
    );

    expect(result).toBe(false);
  });

  it("should detect OAuth when auth server has only authorization_endpoint", async () => {
    const mockFetch = createMockFetch({
      "https://test.example.com/.well-known/oauth-protected-resource": {
        status: 404,
      },
      "https://test.example.com/.well-known/oauth-authorization-server": {
        status: 200,
        body: {
          authorization_endpoint: "https://auth.example.com/authorize",
          // No token_endpoint
        },
      },
    });

    const result = await detectOAuthSupport(
      mockTargetServer,
      DEFAULT_TIMEOUT_MILLIS,
      noOpLogger,
      mockFetch,
    );

    expect(result).toBe(true);
  });

  it("should detect OAuth when auth server has only token_endpoint", async () => {
    const mockFetch = createMockFetch({
      "https://test.example.com/.well-known/oauth-protected-resource": {
        status: 404,
      },
      "https://test.example.com/.well-known/oauth-authorization-server": {
        status: 200,
        body: {
          // No authorization_endpoint
          token_endpoint: "https://auth.example.com/token",
        },
      },
    });

    const result = await detectOAuthSupport(
      mockTargetServer,
      DEFAULT_TIMEOUT_MILLIS,
      noOpLogger,
      mockFetch,
    );

    expect(result).toBe(true);
  });

  it("should return false when requests timeout", async () => {
    const mockFetch: FetchFn = async (_input, init) => {
      // Simulate a delay longer than our timeout
      await new Promise((resolve) => setTimeout(resolve, 5));

      // Check if the request was aborted
      if (init?.signal?.aborted) {
        throw new Error("The operation was aborted");
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          authorization_servers: ["https://auth.example.com"],
        }),
      } as unknown as Response;
    };

    // Use a 2ms timeout as requested
    const result = await detectOAuthSupport(
      mockTargetServer,
      1, // 1ms timeout
      noOpLogger,
      mockFetch,
    );

    expect(result).toBe(false);
  });
});
