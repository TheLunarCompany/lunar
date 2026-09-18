import {
  remoteUrlSchema,
  isRemoteUrlValid,
  remoteServerSchema,
  mcpJsonSchema,
} from "./mcpJson.js";

describe("remoteUrlSchema", () => {
  const valid = (url: string) =>
    expect(remoteUrlSchema.safeParse(url).success).toBe(true);
  const invalid = (url: string, message: string) => {
    const result = remoteUrlSchema.safeParse(url);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain(message);
    }
  };

  describe("valid URLs", () => {
    it.each([
      "https://app.workato.com/mcp?dev_api_token=",
      "https://app.workato.com/mcp?dev_api_token=abc123",
      "https://api.example.com/mcp?token=abc&scope=read",
      "https://api.example.com/sse",
      "https://api.example.com/v1.0/mcp",
      "http://localhost:3000/mcp",
      "http://localhost/mcp",
      "http://my-k8s-service/mcp",
      "http://internal.service.svc.cluster.local/mcp",
      "https://example.com",
      "https://example.com/",
    ])("accepts %s", (url) => valid(url));
  });

  describe("invalid URLs", () => {
    it("rejects empty string with 'URL is required'", () => {
      invalid("", "URL is required");
    });

    it("rejects non-URL strings with 'Invalid URL'", () => {
      invalid("not-a-url", "Invalid URL");
      invalid("//example.com", "Invalid URL");
    });

    it("rejects javascript: URLs with 'URL must use http or https'", () => {
      invalid("javascript:alert(1)", "URL must use http or https");
    });

    it("rejects ftp: URLs with 'URL must use http or https'", () => {
      invalid("ftp://example.com", "URL must use http or https");
    });

    it("rejects data: URLs with 'URL must use http or https'", () => {
      invalid("data:text/html,<h1>hi</h1>", "URL must use http or https");
    });
  });
});

describe("isRemoteUrlValid", () => {
  it.each([
    "https://app.workato.com/mcp?dev_api_token=",
    "https://app.workato.com/mcp?token=abc123&other=xyz",
    "http://localhost:3000/mcp",
    "http://my-k8s-service/mcp",
    "https://api.example.com/v1.0/mcp",
    "https://example.com",
  ])("returns true for %s", (url) => {
    expect(isRemoteUrlValid(url)).toBe(true);
  });

  it.each(["javascript:alert(1)", "ftp://example.com", "not-a-url", ""])(
    "returns false for %s",
    (url) => {
      expect(isRemoteUrlValid(url)).toBe(false);
    },
  );
});

describe("remoteServerSchema", () => {
  it("accepts a remote server with query-param URL", () => {
    const result = remoteServerSchema.safeParse({
      url: "https://app.workato.com/mcp?dev_api_token=secret123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a remote server with an invalid URL", () => {
    const result = remoteServerSchema.safeParse({ url: "not-a-url" });
    expect(result.success).toBe(false);
  });
});

describe("mcpJsonSchema — remote server with query-param URL", () => {
  it("accepts the Workato convention", () => {
    const result = mcpJsonSchema.safeParse({
      "workato-dev-api": {
        url: "https://app.workato.com/mcp?dev_api_token=",
      },
    });
    expect(result.success).toBe(true);
  });
});
