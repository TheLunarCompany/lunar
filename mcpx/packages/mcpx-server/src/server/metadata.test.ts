import { extractMetadata, isProbeClient } from "./metadata.js";
import { IncomingHttpHeaders } from "http";

describe("metadata extraction", () => {
  describe("extractMetadata", () => {
    it("should extract mcp-remote adapter with version", () => {
      const body = {
        params: {
          protocolVersion: "0.1.0",
          clientInfo: {
            name: "claude-ai (via mcp-remote 0.1.15)",
            version: "1.0.0",
          },
        },
      };

      const metadata = extractMetadata({}, body);

      expect(metadata.clientInfo.name).toBe("claude-ai");
      expect(metadata.clientInfo.adapter).toBeDefined();
      expect(metadata.clientInfo.adapter?.name).toBe("mcp-remote");
      expect(metadata.clientInfo.adapter?.version?.major).toBe(0);
      expect(metadata.clientInfo.adapter?.version?.minor).toBe(1);
      expect(metadata.clientInfo.adapter?.version?.patch).toBe(15);
      expect(metadata.clientInfo.adapter?.support?.ping).toBe(true);
    });

    it("should detect mcp-remote without version", () => {
      const body = {
        params: {
          protocolVersion: "0.1.0",
          clientInfo: {
            name: "Claude (via mcp-remote)",
            version: "1.0.0",
          },
        },
      };

      const metadata = extractMetadata({}, body);

      expect(metadata.clientInfo.name).toBe("Claude");
      expect(metadata.clientInfo.adapter?.name).toBe("mcp-remote");
      expect(metadata.clientInfo.adapter?.version).toBeUndefined();
      expect(metadata.clientInfo.adapter?.support).toBeUndefined();
    });

    it("should determine ping support based on version", () => {
      const cases: [string, boolean][] = [
        ["claude-ai (via mcp-remote-0.1.19)", true], // older than legacy max — supported
        ["claude-ai (via mcp-remote-0.1.21)", true], // legacy max — supported
        ["claude-ai (via mcp-remote-0.1.22)", false], // in the gap — not supported
        ["claude-ai (via mcp-remote-0.1.23)", false], // in the gap — not supported
        ["claude-ai (via mcp-remote-0.1.36)", true], // pinned version — supported
        ["claude-ai (via mcp-remote-0.1.50)", false], // beyond latest — not supported
      ];

      for (const [name, expectedPing] of cases) {
        const body = {
          params: {
            protocolVersion: "0.1.0",
            clientInfo: { name, version: "1.0.0" },
          },
        };
        const metadata = extractMetadata({}, body);
        expect(metadata.clientInfo.adapter?.support?.ping).toBe(expectedPing);
      }
    });

    it("should handle malformed request body gracefully", () => {
      const headers: IncomingHttpHeaders = {
        "x-lunar-consumer-tag": "test-consumer",
        "x-lunar-llm-provider": "anthropic",
        "x-lunar-llm-model-id": "claude-3",
      };
      const body = { invalid: "structure" };

      const metadata = extractMetadata(headers, body);

      expect(metadata.consumerTag).toBe("test-consumer");
      expect(metadata.llm?.provider).toBe("anthropic");
      expect(metadata.llm?.modelId).toBe("claude-3");
      expect(metadata.clientInfo).toEqual({});
      expect(metadata.isProbe).toBe(false);
    });

    it("should generate unique client IDs", () => {
      const body = {
        params: {
          protocolVersion: "0.1.0",
          clientInfo: { name: "test", version: "1.0.0" },
        },
      };

      const metadata1 = extractMetadata({}, body);
      const metadata2 = extractMetadata({}, body);

      expect(metadata1.clientId).toBeDefined();
      expect(metadata2.clientId).toBeDefined();
      expect(metadata1.clientId).not.toBe(metadata2.clientId);
      expect(metadata1.clientId).toMatch(/^client-\d+-[a-z0-9]{9}$/);
    });

    it("should not detect mcp-remote-fallback-test as having adapter", () => {
      const body = {
        params: {
          protocolVersion: "0.1.0",
          clientInfo: {
            name: "mcp-remote-fallback-test",
            version: "1.0.0",
          },
        },
      };

      const metadata = extractMetadata({}, body);

      expect(metadata.clientInfo.adapter).toBeUndefined();
      expect(metadata.clientInfo.name).toBe("mcp-remote-fallback-test");
    });

    it("should detect probe clients", () => {
      const probeBody = {
        params: {
          protocolVersion: "0.1.0",
          clientInfo: {
            name: "mcp-remote-fallback-test",
            version: "1.0.0",
          },
        },
      };

      const normalBody = {
        params: {
          protocolVersion: "0.1.0",
          clientInfo: {
            name: "Claude",
            version: "1.0.0",
          },
        },
      };

      const probeMetadata = extractMetadata({}, probeBody);
      const normalMetadata = extractMetadata({}, normalBody);

      expect(probeMetadata.isProbe).toBe(true);
      expect(normalMetadata.isProbe).toBe(false);
    });
  });

  describe("isProbeClient", () => {
    it("should identify probe client names", () => {
      expect(isProbeClient("mcp-remote-fallback-test")).toBe(true);
      expect(isProbeClient("Claude")).toBe(false);
      expect(isProbeClient("mcp-remote")).toBe(false);
      expect(isProbeClient(undefined)).toBe(false);
      expect(isProbeClient("")).toBe(false);
    });
  });
});
