import { noOpLogger } from "@mcpx/toolkit-core/logging";
import { auth } from "@modelcontextprotocol/sdk/client/auth.js";
import {
  OAuthClientInformationFull,
  OAuthClientInformationFullSchema,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { DcrOAuthProvider } from "./dcr.js";
import { OAuthTokenStoreI } from "../services/oauth-token-store.js";
import { buildClientMetadataDocument } from "@mcpx/toolkit-core/oauth";
import { resetEnv } from "../env.js";

const ROUTER = "https://mcpx-stg.lunar.dev";
const CIMD_URL = `${ROUTER}/.well-known/oauth-client-metadata.json`;
const SERVER = "https://mcp.chilipiper.example/mcp";

/**
 * Both halves of the flow, through the real SDK. A CIMD client is saved as
 * `{ client_id }` alone, so if that record doesn't survive the store,
 * authorization still succeeds and only the code exchange fails.
 */

// Mirrors HubTokenClient: opaque writes, schema-validated reads that throw.
function makeStore(): OAuthTokenStoreI {
  let client: unknown;
  let verifier: string | undefined;
  return {
    loadTokens: async () => undefined,
    saveTokens: async () => {},
    loadCodeVerifier: async () => verifier,
    saveCodeVerifier: async (_name, value) => {
      verifier = value;
    },
    loadClientInfo: async () => {
      if (!client) return undefined;
      const parsed = OAuthClientInformationFullSchema.safeParse(client);
      if (!parsed.success) throw new Error("Invalid client payload from hub");
      return parsed.data;
    },
    saveClientInfo: async (_name, info) => {
      client = JSON.parse(JSON.stringify(info));
    },
    deleteAll: async () => {},
  };
}

const AS_METADATA = {
  issuer: "https://as.example",
  authorization_endpoint: "https://as.example/authorize",
  token_endpoint: "https://as.example/token",
  registration_endpoint: "https://as.example/register",
  response_types_supported: ["code"],
  code_challenge_methods_supported: ["S256"],
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

function makeAuthServer(options: { supportsCimd: boolean }): {
  fetchFn: typeof fetch;
  registered: () => boolean;
  tokenRequest: () => URLSearchParams | undefined;
} {
  let registered = false;
  let tokenRequest: URLSearchParams | undefined;
  const fetchFn = (async (url: string | URL, init?: RequestInit) => {
    const target = url.toString();
    if (target.includes("oauth-protected-resource")) {
      return json({
        resource: "https://mcp.chilipiper.example",
        authorization_servers: [AS_METADATA.issuer],
      });
    }
    if (target.endsWith("/register")) {
      registered = true;
      return json(
        { ...JSON.parse(init?.body as string), client_id: "dcr-issued-id" },
        201,
      );
    }
    if (target.endsWith("/token")) {
      tokenRequest = new URLSearchParams(init?.body as string);
      return json({ access_token: "at", token_type: "bearer" });
    }
    if (target.includes(".well-known")) {
      return json({
        ...AS_METADATA,
        client_id_metadata_document_supported: options.supportsCimd,
      });
    }
    return json({}, 404);
  }) as unknown as typeof fetch;
  return {
    fetchFn,
    registered: () => registered,
    tokenRequest: () => tokenRequest,
  };
}

const buildProvider = (
  serverName: string,
  store: OAuthTokenStoreI,
): DcrOAuthProvider =>
  new DcrOAuthProvider({
    serverName,
    callbackUrl: `${ROUTER}/auth/callback`,
    logger: noOpLogger,
    tokenStore: store,
  });

describe("OAuth flow against a CIMD-capable server", () => {
  beforeEach(() => {
    process.env["VERSION"] = "1.0.0";
    process.env["INSTANCE_ID"] = "0";
    process.env["INSTANCE_KEY"] = "space-123";
    process.env["MCPX_SERVER_URL"] = ROUTER;
    resetEnv();
  });

  afterEach(() => {
    delete process.env["INSTANCE_KEY"];
    delete process.env["MCPX_SERVER_URL"];
    resetEnv();
  });

  it("authorizes with the document URL as client id, then exchanges the code", async () => {
    const as = makeAuthServer({ supportsCimd: true });
    const provider = buildProvider("chili-piper", makeStore());
    // Mirrors settleClientIdentity before auth().
    provider.applyPublishedDocument(
      buildClientMetadataDocument({ baseUrl: ROUTER }),
    );

    expect(
      await auth(provider, { serverUrl: SERVER, fetchFn: as.fetchFn }),
    ).toBe("REDIRECT");

    const authorizationUrl = provider.getAuthorizationUrl();
    expect(authorizationUrl?.searchParams.get("client_id")).toBe(CIMD_URL);
    expect(authorizationUrl?.searchParams.get("redirect_uri")).toBe(
      `${ROUTER}/auth/callback`,
    );
    expect(as.registered()).toBe(false);

    // Used to throw "Existing OAuth client information is required".
    expect(
      await auth(provider, {
        serverUrl: SERVER,
        authorizationCode: "the-code",
        fetchFn: as.fetchFn,
      }),
    ).toBe("AUTHORIZED");
    expect(as.tokenRequest()?.get("client_id")).toBe(CIMD_URL);
  });

  it("falls back to DCR for a server that does not advertise CIMD", async () => {
    const as = makeAuthServer({ supportsCimd: false });
    const store = makeStore();
    const provider = buildProvider("notion", store);

    expect(
      await auth(provider, { serverUrl: SERVER, fetchFn: as.fetchFn }),
    ).toBe("REDIRECT");

    expect(as.registered()).toBe(true);
    expect(provider.getAuthorizationUrl()?.searchParams.get("client_id")).toBe(
      "dcr-issued-id",
    );
    const stored = (await store.loadClientInfo(
      "notion",
    )) as OAuthClientInformationFull;
    expect(stored.client_id).toBe("dcr-issued-id");
  });
});
