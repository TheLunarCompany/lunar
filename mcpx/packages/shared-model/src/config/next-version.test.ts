import {
  consumerConfigSchema,
  staticOAuthProviderSchema,
} from "./next-version.js";

describe("consumerConfigSchema", () => {
  describe("with _type present", () => {
    it("parses default-block config", () => {
      const result = consumerConfigSchema.safeParse({
        _type: "default-block",
        allow: ["tool-group-1"],
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        _type: "default-block",
        allow: ["tool-group-1"],
      });
    });

    it("parses default-allow config", () => {
      const result = consumerConfigSchema.safeParse({
        _type: "default-allow",
        block: ["tool-group-1"],
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        _type: "default-allow",
        block: ["tool-group-1"],
      });
    });

    it("preserves consumerGroupKey", () => {
      const result = consumerConfigSchema.safeParse({
        _type: "default-block",
        consumerGroupKey: "cursor-vscode Profile",
        allow: ["foo"],
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        _type: "default-block",
        consumerGroupKey: "cursor-vscode Profile",
        allow: ["foo"],
      });
    });
  });

  describe("with _type missing (legacy data)", () => {
    it("infers default-block from allow field", () => {
      const result = consumerConfigSchema.safeParse({
        allow: ["tool-group-1"],
        consumerGroupKey: "cursor-vscode Profile",
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        _type: "default-block",
        consumerGroupKey: "cursor-vscode Profile",
        allow: ["tool-group-1"],
      });
    });

    it("infers default-allow from block field", () => {
      const result = consumerConfigSchema.safeParse({
        block: ["admin-tools"],
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        _type: "default-allow",
        block: ["admin-tools"],
      });
    });

    it("infers default-block from empty allow array", () => {
      const result = consumerConfigSchema.safeParse({
        allow: [],
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        _type: "default-block",
        allow: [],
      });
    });

    it("infers default-allow from empty block array", () => {
      const result = consumerConfigSchema.safeParse({
        block: [],
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        _type: "default-allow",
        block: [],
      });
    });
  });

  describe("invalid data", () => {
    it("rejects config with neither allow nor block", () => {
      const result = consumerConfigSchema.safeParse({
        consumerGroupKey: "test",
      });
      expect(result.success).toBe(false);
    });

    it("rejects null", () => {
      const result = consumerConfigSchema.safeParse(null);
      expect(result.success).toBe(false);
    });

    it("rejects wrong _type value", () => {
      const result = consumerConfigSchema.safeParse({
        _type: "default-deny",
        allow: ["foo"],
      });
      expect(result.success).toBe(false);
    });

    it("when both allow and block are present, allow wins (infers default-block)", () => {
      const result = consumerConfigSchema.safeParse({
        allow: ["foo"],
        block: ["bar"],
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        _type: "default-block",
        allow: ["foo"],
      });
    });
  });
});

// ============================================
// staticOAuthProviderSchema
//
// The wire shape sent from hub → mcpx via apply-setup, also used to
// parse static-OAuth config out of app.yaml at boot. Two evolutions
// land together:
//   1. Each credential field (clientId, clientSecret) is independently
//      either a literal value or a reference to an env var.
//   2. Existing whole-shape configs (literal-only or envRef-only)
//      keep parsing unchanged — they transform to the new canonical
//      per-field form so consumers see one normalized output.
// ============================================

const ccBase = {
  authMethod: "client_credentials" as const,
  scopes: ["read"],
  tokenAuthMethod: "client_secret_basic" as const,
};

const dfBase = {
  authMethod: "device_flow" as const,
  scopes: ["read"],
  endpoints: {
    deviceAuthorizationUrl: "https://github.com/login/device/code",
    tokenUrl: "https://github.com/login/oauth/access_token",
    userVerificationUrl: "https://github.com/login/device",
  },
};

describe("staticOAuthProviderSchema — client_credentials", () => {
  describe("new per-field shape", () => {
    it("parses literal id + literal secret", () => {
      const result = staticOAuthProviderSchema.safeParse({
        ...ccBase,
        credentials: {
          clientId: { type: "literal", value: "id-abc" },
          clientSecret: { type: "literal", value: "secret-xyz" },
        },
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        ...ccBase,
        credentials: {
          clientId: { type: "literal", value: "id-abc" },
          clientSecret: { type: "literal", value: "secret-xyz" },
        },
      });
    });

    it("parses envRef id + envRef secret", () => {
      const result = staticOAuthProviderSchema.safeParse({
        ...ccBase,
        credentials: {
          clientId: { type: "envRef", envName: "GH_CLIENT_ID" },
          clientSecret: { type: "envRef", envName: "GH_CLIENT_SECRET" },
        },
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        ...ccBase,
        credentials: {
          clientId: { type: "envRef", envName: "GH_CLIENT_ID" },
          clientSecret: { type: "envRef", envName: "GH_CLIENT_SECRET" },
        },
      });
    });

    it("parses literal id + envRef secret (mixed)", () => {
      const result = staticOAuthProviderSchema.safeParse({
        ...ccBase,
        credentials: {
          clientId: { type: "literal", value: "public-id-abc" },
          clientSecret: { type: "envRef", envName: "GH_CLIENT_SECRET" },
        },
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        ...ccBase,
        credentials: {
          clientId: { type: "literal", value: "public-id-abc" },
          clientSecret: { type: "envRef", envName: "GH_CLIENT_SECRET" },
        },
      });
    });

    it("parses envRef id + literal secret (mixed)", () => {
      const result = staticOAuthProviderSchema.safeParse({
        ...ccBase,
        credentials: {
          clientId: { type: "envRef", envName: "GH_CLIENT_ID" },
          clientSecret: { type: "literal", value: "secret-xyz" },
        },
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        ...ccBase,
        credentials: {
          clientId: { type: "envRef", envName: "GH_CLIENT_ID" },
          clientSecret: { type: "literal", value: "secret-xyz" },
        },
      });
    });
  });

  describe("legacy whole-shape (backward compat)", () => {
    // Backward-compat anchor: these inputs are byte-for-byte the legacy
    // whole-shape configs accepted today (DEFAULT_STATIC_OAUTH and
    // hub-emitted apply-setup). They must keep parsing forever - only the
    // parsed *output* is normalized to the new per-field canonical form.
    // Same applies for the device_flow tests below.
    it("parses legacy literal whole-shape and transforms to canonical per-field literal", () => {
      const result = staticOAuthProviderSchema.safeParse({
        ...ccBase,
        credentials: {
          clientId: "id-abc",
          clientSecret: "secret-xyz",
        },
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        ...ccBase,
        credentials: {
          clientId: { type: "literal", value: "id-abc" },
          clientSecret: { type: "literal", value: "secret-xyz" },
        },
      });
    });

    it("parses legacy envRef whole-shape and transforms to canonical per-field envRef", () => {
      const result = staticOAuthProviderSchema.safeParse({
        ...ccBase,
        credentials: {
          clientIdEnv: "GH_CLIENT_ID",
          clientSecretEnv: "GH_CLIENT_SECRET",
        },
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        ...ccBase,
        credentials: {
          clientId: { type: "envRef", envName: "GH_CLIENT_ID" },
          clientSecret: { type: "envRef", envName: "GH_CLIENT_SECRET" },
        },
      });
    });
  });

  describe("invalid", () => {
    it("rejects empty literal value", () => {
      const result = staticOAuthProviderSchema.safeParse({
        ...ccBase,
        credentials: {
          clientId: { type: "literal", value: "" },
          clientSecret: { type: "literal", value: "secret-xyz" },
        },
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty envName", () => {
      const result = staticOAuthProviderSchema.safeParse({
        ...ccBase,
        credentials: {
          clientId: { type: "envRef", envName: "" },
          clientSecret: { type: "envRef", envName: "GH_CLIENT_SECRET" },
        },
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing clientSecret in new shape", () => {
      const result = staticOAuthProviderSchema.safeParse({
        ...ccBase,
        credentials: {
          clientId: { type: "literal", value: "id-abc" },
        },
      });
      expect(result.success).toBe(false);
    });

    it("rejects mixing legacy and new shape (legacy literal id + new envRef secret)", () => {
      const result = staticOAuthProviderSchema.safeParse({
        ...ccBase,
        credentials: {
          clientId: "id-abc",
          clientSecret: { type: "envRef", envName: "GH_CLIENT_SECRET" },
        },
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing tokenAuthMethod", () => {
      const result = staticOAuthProviderSchema.safeParse({
        authMethod: "client_credentials",
        scopes: ["read"],
        credentials: {
          clientId: { type: "literal", value: "id-abc" },
          clientSecret: { type: "literal", value: "secret-xyz" },
        },
      });
      expect(result.success).toBe(false);
    });
  });
});

describe("staticOAuthProviderSchema — device_flow", () => {
  describe("new per-field shape", () => {
    it("parses literal clientId", () => {
      const result = staticOAuthProviderSchema.safeParse({
        ...dfBase,
        credentials: {
          clientId: { type: "literal", value: "id-abc" },
        },
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        ...dfBase,
        credentials: {
          clientId: { type: "literal", value: "id-abc" },
        },
      });
    });

    it("parses envRef clientId", () => {
      const result = staticOAuthProviderSchema.safeParse({
        ...dfBase,
        credentials: {
          clientId: { type: "envRef", envName: "GH_CLIENT_ID" },
        },
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        ...dfBase,
        credentials: {
          clientId: { type: "envRef", envName: "GH_CLIENT_ID" },
        },
      });
    });
  });

  describe("legacy whole-shape (backward compat)", () => {
    // Same comment as in client_credentials, see above.
    it("parses legacy literal {clientId} and transforms to canonical", () => {
      const result = staticOAuthProviderSchema.safeParse({
        ...dfBase,
        credentials: { clientId: "id-abc" },
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        ...dfBase,
        credentials: { clientId: { type: "literal", value: "id-abc" } },
      });
    });

    it("parses legacy envRef {clientIdEnv} and transforms to canonical", () => {
      const result = staticOAuthProviderSchema.safeParse({
        ...dfBase,
        credentials: { clientIdEnv: "GH_CLIENT_ID" },
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        ...dfBase,
        credentials: { clientId: { type: "envRef", envName: "GH_CLIENT_ID" } },
      });
    });
  });

  describe("invalid", () => {
    it("rejects missing clientId", () => {
      const result = staticOAuthProviderSchema.safeParse({
        ...dfBase,
        credentials: {},
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty literal value", () => {
      const result = staticOAuthProviderSchema.safeParse({
        ...dfBase,
        credentials: { clientId: { type: "literal", value: "" } },
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty envName", () => {
      const result = staticOAuthProviderSchema.safeParse({
        ...dfBase,
        credentials: { clientId: { type: "envRef", envName: "" } },
      });
      expect(result.success).toBe(false);
    });
  });
});
