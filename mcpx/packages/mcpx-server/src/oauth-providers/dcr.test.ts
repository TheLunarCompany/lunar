import { noOpLogger } from "@mcpx/toolkit-core/logging";
import {
  OAuthClientInformationFull,
  OAuthClientInformationFullSchema,
  OAuthClientMetadata,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { DcrOAuthProvider } from "./dcr.js";
import { OAuthTokenStoreI } from "../services/oauth-token-store.js";
import {
  buildClientMetadataDocument,
  CLIENT_METADATA_PATH,
  clientRedirectUris,
} from "@mcpx/toolkit-core/oauth";
import { resetEnv } from "../env.js";

const stubTokenStore: OAuthTokenStoreI = {
  loadTokens: async () => undefined,
  saveTokens: async () => {},
  loadCodeVerifier: async () => undefined,
  saveCodeVerifier: async () => {},
  loadClientInfo: async () => undefined,
  saveClientInfo: async () => {},
  deleteAll: async () => {},
};

describe("DcrOAuthProvider#redirectToAuthorization", () => {
  // Regression: it used to block on a promise resolved only when the user
  // completed the redirect, which hung silent token-reuse during setup-apply.
  it("resolves immediately and records the URL (does not block on the user)", async () => {
    const provider = new DcrOAuthProvider({
      serverName: "notion",
      logger: noOpLogger,
      tokenStore: stubTokenStore,
    });

    const outcome = await Promise.race([
      provider
        .redirectToAuthorization(new URL("https://mcp.notion.com/authorize"))
        .then(() => "resolved" as const),
      new Promise<"blocked">((resolve) =>
        setTimeout(() => resolve("blocked"), 100),
      ),
    ]);

    expect(outcome).toBe("resolved");
    expect(provider.getAuthorizationUrl()?.host).toBe("mcp.notion.com");
  });
});

const ROUTER = "https://mcpx-stg.lunar.dev";
// Derived from the shared contract, so a change there fails here too.
const CIMD_URL = `${ROUTER}${CLIENT_METADATA_PATH}`;

describe("DcrOAuthProvider#clientMetadataUrl (CIMD)", () => {
  // Touch only the keys under test; the suite's own env stays intact.
  const setEnv = (vars: Record<string, string | undefined>): void => {
    for (const [key, value] of Object.entries(vars)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    resetEnv();
  };

  const build = (callbackUrl = `${ROUTER}/auth/callback`): DcrOAuthProvider =>
    new DcrOAuthProvider({
      serverName: "chili-piper",
      callbackUrl,
      logger: noOpLogger,
      tokenStore: stubTokenStore,
    });

  beforeEach(() => {
    setEnv({
      VERSION: "1.0.0", // required by the env schema, unrelated to CIMD
      INSTANCE_ID: "0",
      INSTANCE_KEY: "space-123", // IS_ENTERPRISE is derived from this
      MCPX_SERVER_URL: ROUTER,
    });
  });

  afterEach(() => {
    setEnv({ INSTANCE_KEY: undefined, MCPX_SERVER_URL: undefined });
  });

  it("points at the router's document over HTTPS in enterprise mode", () => {
    expect(build().clientMetadataUrl).toBe(CIMD_URL);
  });

  it("is undefined when not enterprise (no router serves the file, DCR used)", () => {
    setEnv({ INSTANCE_KEY: undefined });

    expect(build().clientMetadataUrl).toBeUndefined();
  });

  it("is undefined when MCPX_SERVER_URL is not HTTPS (enterprise local dev)", () => {
    setEnv({ MCPX_SERVER_URL: "http://127.0.0.1:9000" });

    expect(
      build("http://127.0.0.1:9000/auth/callback").clientMetadataUrl,
    ).toBeUndefined();
  });

  it("accepts every callback the document publishes, and only those", () => {
    // The invariant that used to live in two hand-kept lists.
    for (const redirectUri of clientRedirectUris(ROUTER)) {
      expect(build(redirectUri).clientMetadataUrl).toBe(CIMD_URL);
    }
  });

  it("reports why CIMD was skipped, for the flow log", () => {
    // The interesting case is a server that would have accepted CIMD, so the
    // reason has to say which gate declined rather than just that one did.
    setEnv({ INSTANCE_KEY: undefined });
    expect(build().clientMetadataSkipReason()).toBe(
      "not an enterprise instance",
    );

    setEnv({ INSTANCE_KEY: "space-123" });
    expect(
      build("https://app.lunar.dev/oauth/callback").clientMetadataSkipReason(),
    ).toContain("is not in the document");

    expect(build().clientMetadataSkipReason()).toBeUndefined();
  });

  it("is undefined when the flow's callback is not one the document publishes", () => {
    // Sandbox analysis starts flows against its own host, so CIMD would fail
    // invalid_redirect_uri. DCR registers whatever redirect_uri we use.
    expect(
      build("https://app.lunar.dev/oauth/callback").clientMetadataUrl,
    ).toBeUndefined();
  });
});

describe("DcrOAuthProvider#saveClientInformation", () => {
  // The SDK saves `{ client_id }` alone on the CIMD path. The stores require
  // redirect_uris on read, so an unpadded record is lost and the exchange fails.
  const buildWithMemoryStore = (): {
    provider: DcrOAuthProvider;
    saved: () => unknown;
  } => {
    let stored: OAuthClientInformationFull | undefined;
    const provider = new DcrOAuthProvider({
      serverName: "chili-piper",
      callbackUrl: `${ROUTER}/auth/callback`,
      logger: noOpLogger,
      tokenStore: {
        ...stubTokenStore,
        saveClientInfo: async (_name, info) => {
          stored = info;
        },
        loadClientInfo: async () => {
          if (!stored) return undefined;
          const parsed = OAuthClientInformationFullSchema.safeParse(stored);
          // Mirrors HubTokenClient, which throws when the record is malformed.
          if (!parsed.success) throw new Error("Invalid client payload");
          return parsed.data;
        },
      },
    });
    return { provider, saved: () => stored };
  };

  it("backfills a CIMD client id so it survives a store round-trip", async () => {
    const { provider } = buildWithMemoryStore();

    await provider.saveClientInformation({
      client_id: CIMD_URL,
    } as OAuthClientInformationFull);

    const loaded = await provider.clientInformation();
    expect(loaded?.client_id).toBe(CIMD_URL);
    expect(loaded?.redirect_uris).toEqual([`${ROUTER}/auth/callback`]);
  });

  it("keeps a DCR registration's own fields", async () => {
    const { provider, saved } = buildWithMemoryStore();

    await provider.saveClientInformation({
      client_id: "dcr-issued-id",
      client_secret: "shh",
      redirect_uris: ["https://registered.example/cb"],
    } as OAuthClientInformationFull);

    expect(saved()).toMatchObject({
      client_id: "dcr-issued-id",
      client_secret: "shh",
      redirect_uris: ["https://registered.example/cb"],
    });
  });
});

describe("the CIMD document shape", () => {
  // toolkit-core has no SDK dependency, so only a package with both can check
  // its shape claim. The assignment is the check: it stops compiling on drift.
  it("stays assignable to the SDK's client metadata", () => {
    const doc: OAuthClientMetadata = buildClientMetadataDocument(ROUTER);

    expect(doc.redirect_uris).toEqual(clientRedirectUris(ROUTER));
  });
});
