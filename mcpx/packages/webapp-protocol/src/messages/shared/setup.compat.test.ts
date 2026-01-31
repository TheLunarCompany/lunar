import {
  targetServerSchema,
  targetServerStdioSchema,
  targetServerSseSchema,
  targetServerStreamableHttpSchema,
  envValueSchema,
} from "./setup.js";

/**
 * Backward/Forward Compatibility Tests for Target Server Schemas
 *
 * These tests ensure schema changes don't break existing data or client compatibility.
 *
 * IMPORTANT: These examples represent real data formats
 * and messages sent by mcpx-server clients.
 *
 * Compatibility directions:
 * - Backward: New webapp code must read old DB data
 * - Forward: New webapp must accept messages from older mcpx-server versions
 *
 * Rules:
 * - NEVER remove historical examples - only add new ones
 * - If a test fails after schema changes, you're breaking compatibility
 * - Add new format variants when the schema evolves
 */

describe("envValueSchema backward/forward compatibility", () => {
  const validFormats: [string, unknown][] = [
    // String values (direct literals)
    ["empty string", ""],
    ["simple string", "value"],
    ["string with special chars", "key=value&foo=bar"],
    ["string with spaces", "hello world"],
    ["numeric string", "12345"],
    ["url string", "https://example.com/api"],

    // fromEnv references
    ["fromEnv uppercase", { fromEnv: "API_KEY" }],
    ["fromEnv with numbers", { fromEnv: "VAR_123" }],

    // Explicitly unset value
    ["null", null],
  ];

  it.each(validFormats)(
    "should parse valid format: %s",
    (_description, data) => {
      const result = envValueSchema.safeParse(data);
      expect(result.success).toBe(true);
    },
  );

  const invalidFormats: [string, unknown][] = [
    ["undefined", undefined],
    ["number", 123],
    ["boolean", true],
    ["array", ["value"]],
    ["empty object", {}],
    ["fromEnv with wrong key", { fromEnvironment: "VAR" }],
    // Note: { fromEnv: "VAR", extra: "bad" } is VALID - Zod strips unknown keys (good for forward compat)
    ["fromEnv with non-string value", { fromEnv: 123 }],
    ["nested object", { nested: { fromEnv: "VAR" } }],
  ];

  it.each(invalidFormats)(
    "should reject invalid format: %s",
    (_description, data) => {
      const result = envValueSchema.safeParse(data);
      expect(result.success).toBe(false);
    },
  );
});

describe("targetServerStdioSchema backward/forward compatibility", () => {
  const validFormats: [string, unknown][] = [
    // Minimal configurations - all allowed commands
    ["npx minimal", { type: "stdio", command: "npx" }],
    ["uvx minimal", { type: "stdio", command: "uvx" }],
    ["docker minimal", { type: "stdio", command: "docker" }],
    ["node minimal", { type: "stdio", command: "node" }],

    // With args variations
    ["with empty args", { type: "stdio", command: "npx", args: [] }],
    ["with single arg", { type: "stdio", command: "npx", args: ["-y"] }],
    [
      "with multiple args",
      { type: "stdio", command: "npx", args: ["-y", "some-package"] },
    ],
    [
      "with complex args",
      {
        type: "stdio",
        command: "docker",
        args: ["run", "-it", "--rm", "image:tag"],
      },
    ],

    // With env variations - empty
    ["with empty env", { type: "stdio", command: "npx", env: {} }],

    // With env - null values
    [
      "with null env values",
      { type: "stdio", command: "npx", env: { KEY: null } },
    ],

    // With env - string values only
    [
      "with string env values",
      {
        type: "stdio",
        command: "npx",
        env: { KEY: "value", DEBUG: "true" },
      },
    ],

    // With env - fromEnv references only
    [
      "with fromEnv references",
      {
        type: "stdio",
        command: "uvx",
        env: {
          API_KEY: { fromEnv: "ACTUAL_API_KEY" },
          SECRET: { fromEnv: "MY_SECRET" },
        },
      },
    ],

    // With env - mixed string and fromEnv
    [
      "with mixed env values",
      {
        type: "stdio",
        command: "npx",
        env: {
          LITERAL: "direct-value",
          REFERENCE: { fromEnv: "ENV_VAR" },
          DEBUG: "false",
          TOKEN: { fromEnv: "AUTH_TOKEN" },
        },
      },
    ],

    // With icon
    [
      "with icon",
      { type: "stdio", command: "npx", icon: "https://example.com/icon.png" },
    ],

    // Full configuration
    [
      "full configuration",
      {
        type: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem"],
        env: {
          PATH_PREFIX: "/home/user",
          API_KEY: { fromEnv: "MCP_API_KEY" },
        },
        icon: "https://example.com/fs-icon.svg",
      },
    ],

    // Edge cases
    [
      "with empty string env value",
      { type: "stdio", command: "npx", env: { EMPTY: "" } },
    ],
    [
      "with many env vars",
      {
        type: "stdio",
        command: "node",
        env: {
          VAR1: "val1",
          VAR2: { fromEnv: "VAR2" },
          VAR3: "val3",
          VAR4: { fromEnv: "VAR4" },
          VAR5: "val5",
        },
      },
    ],
  ];

  it.each(validFormats)(
    "should parse valid format: %s",
    (_description, data) => {
      const result = targetServerStdioSchema.safeParse(data);
      expect(result.success).toBe(true);
    },
  );

  const invalidFormats: [string, unknown][] = [
    // Missing required fields
    ["missing type", { command: "npx" }],
    ["missing command", { type: "stdio" }],
    ["missing both", {}],

    // Wrong type value
    ["wrong type value", { type: "wrong", command: "npx" }],
    ["type as sse", { type: "sse", command: "npx" }],

    // Invalid command
    ["invalid command", { type: "stdio", command: "invalid" }],
    ["command as number", { type: "stdio", command: 123 }],
    ["empty command", { type: "stdio", command: "" }],

    // Invalid args
    ["args as string", { type: "stdio", command: "npx", args: "not-array" }],
    ["args with numbers", { type: "stdio", command: "npx", args: [1, 2, 3] }],
    ["args as object", { type: "stdio", command: "npx", args: { a: "b" } }],

    // Invalid env
    ["env as array", { type: "stdio", command: "npx", env: [] }],
    ["env as string", { type: "stdio", command: "npx", env: "invalid" }],
    [
      "env with invalid value type",
      { type: "stdio", command: "npx", env: { KEY: 123 } },
    ],
    [
      "env with array value",
      { type: "stdio", command: "npx", env: { KEY: ["a", "b"] } },
    ],

    // Extra unexpected fields at root (strict mode would catch these)
    // Note: Zod by default strips unknown keys, so these may pass unless using strict()
  ];

  it.each(invalidFormats)(
    "should reject invalid format: %s",
    (_description, data) => {
      const result = targetServerStdioSchema.safeParse(data);
      expect(result.success).toBe(false);
    },
  );
});

describe("targetServerSseSchema backward/forward compatibility", () => {
  const validFormats: [string, unknown][] = [
    // Minimal
    ["minimal", { type: "sse", url: "http://example.com" }],
    ["https url", { type: "sse", url: "https://secure.example.com/sse" }],
    ["with port", { type: "sse", url: "http://localhost:3000/events" }],
    ["with path", { type: "sse", url: "http://api.example.com/v1/sse/events" }],
    [
      "internal k8s url",
      { type: "sse", url: "http://our-mcp.default.svc.cluster.local" },
    ],

    // With headers
    [
      "with empty headers",
      { type: "sse", url: "http://example.com", headers: {} },
    ],
    [
      "with auth header",
      {
        type: "sse",
        url: "http://example.com",
        headers: { Authorization: "Bearer token123" },
      },
    ],
    [
      "with multiple headers",
      {
        type: "sse",
        url: "http://example.com",
        headers: {
          Authorization: "Bearer token",
          "X-Custom-Header": "custom-value",
          "Content-Type": "application/json",
        },
      },
    ],

    // With icon
    [
      "with icon",
      {
        type: "sse",
        url: "http://example.com",
        icon: "https://cdn.example.com/icon.png",
      },
    ],

    // Full configuration
    [
      "full configuration",
      {
        type: "sse",
        url: "https://api.example.com/mcp/sse",
        headers: {
          Authorization: "Bearer secret",
          "X-API-Version": "2024-01",
        },
        icon: "https://example.com/logo.svg",
      },
    ],
  ];

  it.each(validFormats)(
    "should parse valid format: %s",
    (_description, data) => {
      const result = targetServerSseSchema.safeParse(data);
      expect(result.success).toBe(true);
    },
  );

  const invalidFormats: [string, unknown][] = [
    // Missing required fields
    ["missing type", { url: "http://example.com" }],
    ["missing url", { type: "sse" }],
    ["missing both", {}],

    // Wrong type
    ["wrong type", { type: "stdio", url: "http://example.com" }],
    [
      "type as streamable-http",
      { type: "streamable-http", url: "http://example.com" },
    ],

    // Invalid url
    ["url as number", { type: "sse", url: 123 }],
    ["url as object", { type: "sse", url: { href: "http://example.com" } }],

    // Invalid headers
    [
      "headers as array",
      { type: "sse", url: "http://example.com", headers: [] },
    ],
    [
      "headers as string",
      { type: "sse", url: "http://example.com", headers: "invalid" },
    ],
    [
      "headers with non-string values",
      { type: "sse", url: "http://example.com", headers: { Key: 123 } },
    ],
  ];

  it.each(invalidFormats)(
    "should reject invalid format: %s",
    (_description, data) => {
      const result = targetServerSseSchema.safeParse(data);
      expect(result.success).toBe(false);
    },
  );
});

describe("targetServerStreamableHttpSchema backward/forward compatibility", () => {
  const validFormats: [string, unknown][] = [
    // Minimal
    ["minimal", { type: "streamable-http", url: "http://example.com" }],
    [
      "https url",
      { type: "streamable-http", url: "https://secure.example.com/mcp" },
    ],
    [
      "with port",
      { type: "streamable-http", url: "http://localhost:8080/api" },
    ],

    // With headers
    [
      "with headers",
      {
        type: "streamable-http",
        url: "http://example.com",
        headers: { Authorization: "Bearer token" },
      },
    ],

    // With icon
    [
      "with icon",
      { type: "streamable-http", url: "http://example.com", icon: "icon.png" },
    ],

    // Full configuration
    [
      "full configuration",
      {
        type: "streamable-http",
        url: "https://api.example.com/mcp/http",
        headers: {
          Authorization: "Basic dXNlcjpwYXNz",
          "X-Request-ID": "req-123",
        },
        icon: "https://example.com/http-icon.png",
      },
    ],
  ];

  it.each(validFormats)(
    "should parse valid format: %s",
    (_description, data) => {
      const result = targetServerStreamableHttpSchema.safeParse(data);
      expect(result.success).toBe(true);
    },
  );

  const invalidFormats: [string, unknown][] = [
    ["missing type", { url: "http://example.com" }],
    ["missing url", { type: "streamable-http" }],
    ["wrong type", { type: "sse", url: "http://example.com" }],
  ];

  it.each(invalidFormats)(
    "should reject invalid format: %s",
    (_description, data) => {
      const result = targetServerStreamableHttpSchema.safeParse(data);
      expect(result.success).toBe(false);
    },
  );
});

describe("targetServerSchema (union) backward/forward compatibility", () => {
  /**
   * This tests the discriminated union that accepts any valid target server type.
   * The union discriminates on the 'type' field.
   */
  const validFormats: [string, unknown][] = [
    // stdio variants
    ["stdio minimal", { type: "stdio", command: "npx" }],
    [
      "stdio full",
      { type: "stdio", command: "uvx", args: ["-y", "pkg"], env: { K: "v" } },
    ],

    // sse variants
    ["sse minimal", { type: "sse", url: "http://example.com" }],
    [
      "sse with headers",
      { type: "sse", url: "http://x.com", headers: { A: "B" } },
    ],

    // streamable-http variants
    [
      "streamable-http minimal",
      { type: "streamable-http", url: "http://example.com" },
    ],
    [
      "streamable-http full",
      {
        type: "streamable-http",
        url: "http://x.com",
        headers: { A: "B" },
        icon: "i.png",
      },
    ],
  ];

  it.each(validFormats)(
    "should parse valid format: %s",
    (_description, data) => {
      const result = targetServerSchema.safeParse(data);
      expect(result.success).toBe(true);
    },
  );

  const invalidFormats: [string, unknown][] = [
    // No type field
    ["missing type with url", { url: "http://example.com" }],
    ["missing type with command", { command: "npx" }],

    // Unknown type
    ["unknown type", { type: "websocket", url: "ws://example.com" }],
    ["type as empty string", { type: "", command: "npx" }],

    // Completely wrong structures
    ["null", null],
    ["string", "http://example.com"],
    ["array", [{ type: "sse", url: "http://example.com" }]],
    ["empty object", {}],

    // Mixed/confused schemas (stdio fields on sse, etc.)
    [
      "stdio type with url instead of command",
      { type: "stdio", url: "http://example.com" },
    ],
    ["sse type with command instead of url", { type: "sse", command: "npx" }],
  ];

  it.each(invalidFormats)(
    "should reject invalid format: %s",
    (_description, data) => {
      const result = targetServerSchema.safeParse(data);
      expect(result.success).toBe(false);
    },
  );
});

describe("targetServerSchema type discrimination", () => {
  it("should correctly identify stdio type", () => {
    const data = { type: "stdio", command: "npx", env: { KEY: "val" } };
    const result = targetServerSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success && result.data.type === "stdio") {
      expect(result.data.command).toBe("npx");
      expect(result.data.env).toEqual({ KEY: "val" });
    }
  });

  it("should correctly identify sse type", () => {
    const data = { type: "sse", url: "http://example.com" };
    const result = targetServerSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success && result.data.type === "sse") {
      expect(result.data.url).toBe("http://example.com");
    }
  });

  it("should correctly identify streamable-http type", () => {
    const data = { type: "streamable-http", url: "http://example.com" };
    const result = targetServerSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success && result.data.type === "streamable-http") {
      expect(result.data.url).toBe("http://example.com");
    }
  });
});

describe("targetServerSchema defaults", () => {
  it("should apply defaults for stdio args and env", () => {
    const data = { type: "stdio", command: "npx" };
    const result = targetServerStdioSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.args).toEqual([]);
      expect(result.data.env).toEqual({});
    }
  });

  it("should preserve provided args and env", () => {
    const data = {
      type: "stdio",
      command: "npx",
      args: ["arg1"],
      env: { KEY: "value" },
    };
    const result = targetServerStdioSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.args).toEqual(["arg1"]);
      expect(result.data.env).toEqual({ KEY: "value" });
    }
  });
});
