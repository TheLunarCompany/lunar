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
  PublishedClientMetadata,
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
const WEBSERVER = "https://app-stg.lunar.dev";

describe("DcrOAuthProvider#applyPublishedDocument (CIMD)", () => {
  // Touch only the keys under test; the suite's own env stays intact.
  const setEnv = (vars: Record<string, string | undefined>): void => {
    for (const [key, value] of Object.entries(vars)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    resetEnv();
  };

  // Shared builder — stays in sync with what the router publishes.
  const published = (webserverPublicUrl?: string): PublishedClientMetadata =>
    buildClientMetadataDocument({ baseUrl: ROUTER, webserverPublicUrl });

  // undefined document = "could not be read", not a default.
  const resolve = (
    params: {
      callbackUrl?: string;
      document?: PublishedClientMetadata;
    } = {},
  ): DcrOAuthProvider => {
    const provider = new DcrOAuthProvider({
      serverName: "chili-piper",
      callbackUrl: params.callbackUrl ?? `${ROUTER}/auth/callback`,
      logger: noOpLogger,
      tokenStore: stubTokenStore,
    });
    provider.applyPublishedDocument(params.document);
    return provider;
  };

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

  it("uses the document when it lists this flow's callback", () => {
    expect(resolve({ document: published() }).clientMetadataUrl).toBe(CIMD_URL);
  });

  it("uses it for the webserver callback that catalog analysis sends", () => {
    // Cross-origin callback — only works if the router published it.
    const document = published(WEBSERVER);

    expect(
      resolve({ callbackUrl: `${WEBSERVER}/oauth/callback`, document })
        .clientMetadataUrl,
    ).toBe(CIMD_URL);
  });

  it("declines when the document omits this flow's callback", () => {
    // invalid_redirect_uri; SDK has no DCR fallback with a client id.
    const provider = resolve({
      callbackUrl: `${WEBSERVER}/oauth/callback`,
      document: published(),
    });

    expect(provider.clientMetadataUrl).toBeUndefined();
    expect(provider.clientMetadataSkipReason()).toContain(
      "does not list redirect_uri",
    );
  });

  it("declines when the document could not be read", () => {
    const provider = resolve();

    expect(provider.clientMetadataUrl).toBeUndefined();
    expect(provider.clientMetadataSkipReason()).toContain("could not read");
  });

  it("declines when the document declares a different client_id", () => {
    // e.g. ingress dropped x-forwarded-proto → invalid_client.
    const provider = resolve({
      document: { ...published(), client_id: `http://mcpx-stg.lunar.dev` },
    });

    expect(provider.clientMetadataUrl).toBeUndefined();
    expect(provider.clientMetadataSkipReason()).toContain("declares client_id");
  });

  it("declines when not enterprise, without needing a document", () => {
    setEnv({ INSTANCE_KEY: undefined });
    const provider = resolve({ document: published() });

    expect(provider.clientMetadataUrl).toBeUndefined();
    expect(provider.clientMetadataSkipReason()).toBe(
      "not an enterprise instance",
    );
  });

  it("declines when MCPX_SERVER_URL is not https (local dev)", () => {
    setEnv({ MCPX_SERVER_URL: "http://127.0.0.1:9000" });
    const provider = resolve({
      callbackUrl: "http://127.0.0.1:9000/auth/callback",
      document: published(),
    });

    expect(provider.clientMetadataUrl).toBeUndefined();
    expect(provider.clientMetadataSkipReason()).toContain("is not https");
  });

  it("matches the router's client_id even with a trailing slash on MCPX_SERVER_URL", () => {
    // hive-controller only guarantees an https:// prefix, not a bare origin
    // (crds/mcpx.ts). A trailing slash must not surface as "the router
    // declares a different client_id" — that's a local config issue, not
    // the router's.
    setEnv({ MCPX_SERVER_URL: `${ROUTER}/` });

    expect(resolve({ document: published() }).clientMetadataUrl).toBe(CIMD_URL);
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
    const doc: OAuthClientMetadata = buildClientMetadataDocument({
      baseUrl: ROUTER,
    });

    expect(doc.redirect_uris).toEqual([`${ROUTER}/auth/callback`]);
  });
});
