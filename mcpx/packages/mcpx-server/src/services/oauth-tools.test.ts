import { InitiateOAuthResult } from "./oauth-connection-handler.js";
import { OAuthToolsService } from "./oauth-tools.js";
import { PermissionCheck } from "./capability-resolver.js";

type TextToolContent = { type: "text"; text: string };

const allowAll: PermissionCheck = { hasPermission: () => true };

function getResponseText(response: unknown): string {
  return (response as { content: TextToolContent[] }).content[0]?.text ?? "";
}

interface MockUpstreamHandler {
  initiateOAuthForServer(
    serverName: string,
    callbackUrl?: string,
  ): Promise<InitiateOAuthResult>;
}

function makeHandler(
  initiateResult: InitiateOAuthResult = {
    authorizationUrl: "https://auth.example.com/authorize",
    state: "state-1",
  },
): MockUpstreamHandler {
  return {
    initiateOAuthForServer: async () => initiateResult,
  };
}

describe("OAuthToolsService", () => {
  describe("handleAuthToolCall", () => {
    it("includes the authorizationUrl in the response", async () => {
      const result: InitiateOAuthResult = {
        authorizationUrl: "https://auth.example.com/authorize?state=abc",
        state: "abc",
      };
      const handler = makeHandler(result);
      const service = new OAuthToolsService(handler as never, allowAll);

      const response = await service.handleAuthToolCall("github");

      const text = getResponseText(response);
      expect(text).toContain(result.authorizationUrl);
    });

    it("includes userCode when the result contains one", async () => {
      const result: InitiateOAuthResult = {
        authorizationUrl: "https://auth.example.com",
        state: "state-1",
        userCode: "ABCD-1234",
      };
      const handler = makeHandler(result);
      const service = new OAuthToolsService(handler as never, allowAll);

      const response = await service.handleAuthToolCall("github");

      const text = getResponseText(response);
      expect(text).toContain("ABCD-1234");
    });

    it("omits userCode when not present", async () => {
      const result: InitiateOAuthResult = {
        authorizationUrl: "https://auth.example.com",
        state: "state-1",
      };
      const handler = makeHandler(result);
      const service = new OAuthToolsService(handler as never, allowAll);

      const response = await service.handleAuthToolCall("github");

      const text = getResponseText(response);
      expect(text).not.toContain("User code");
      expect(text.trim()).toBe(result.authorizationUrl);
    });

    it("normalizes the server name before calling initiateOAuthForServer", async () => {
      let capturedName: string | undefined;
      const handler: MockUpstreamHandler = {
        initiateOAuthForServer: async (name) => {
          capturedName = name;
          return { authorizationUrl: "https://auth.example.com", state: "s" };
        },
      };
      const service = new OAuthToolsService(handler as never, allowAll);

      await service.handleAuthToolCall("  GitHub  ");

      expect(capturedName).toBe("github");
    });

    it("passes injected callbackUrl to initiateOAuthForServer", async () => {
      let capturedCallbackUrl: string | undefined;
      const handler: MockUpstreamHandler = {
        initiateOAuthForServer: async (_name, callbackUrl) => {
          capturedCallbackUrl = callbackUrl;
          return { authorizationUrl: "https://auth.example.com", state: "s" };
        },
      };
      const service = new OAuthToolsService(
        handler as never,
        allowAll,
        "https://mcpx.example.com",
      );

      await service.handleAuthToolCall("github");

      expect(capturedCallbackUrl).toBe("https://mcpx.example.com");
    });

    it("returns MCP error response for NotFoundError", async () => {
      const { NotFoundError } = await import("../errors.js");
      const handler: MockUpstreamHandler = {
        initiateOAuthForServer: async () => {
          throw new NotFoundError("Server not found: unknown");
        },
      };
      const service = new OAuthToolsService(handler as never, allowAll);

      const response = await service.handleAuthToolCall("unknown");

      expect(response.isError).toBe(true);
      expect(getResponseText(response)).toContain("Server not found");
    });

    it("returns MCP error response for NotAllowedError", async () => {
      const { NotAllowedError } = await import("../errors.js");
      const handler: MockUpstreamHandler = {
        initiateOAuthForServer: async () => {
          throw new NotAllowedError("Server does not support OAuth");
        },
      };
      const service = new OAuthToolsService(handler as never, allowAll);

      const response = await service.handleAuthToolCall("myserver");

      expect(response.isError).toBe(true);
      expect(getResponseText(response)).toContain("does not support OAuth");
    });

    it("re-throws unexpected errors", async () => {
      const handler: MockUpstreamHandler = {
        initiateOAuthForServer: async () => {
          throw new Error("Unexpected internal error");
        },
      };
      const service = new OAuthToolsService(handler as never, allowAll);

      await expect(service.handleAuthToolCall("github")).rejects.toThrow(
        "Unexpected internal error",
      );
    });
  });
});
