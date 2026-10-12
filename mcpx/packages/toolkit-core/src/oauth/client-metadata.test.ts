import {
  buildClientMetadataDocument,
  clientMetadataDocumentSchema,
  CLIENT_METADATA_PATH,
} from "./client-metadata.js";

const ROUTER = "https://mcpx-stg.lunar.dev";
const WEBSERVER = "https://app-stg.lunar.dev";

describe("buildClientMetadataDocument", () => {
  it("client_id equals the URL the document is served from", () => {
    // Servers reject the document when these disagree.
    expect(buildClientMetadataDocument({ baseUrl: ROUTER }).client_id).toBe(
      `${ROUTER}${CLIENT_METADATA_PATH}`,
    );
  });

  it("advertises the callback the space flow is sent back to", () => {
    expect(
      buildClientMetadataDocument({ baseUrl: ROUTER }).redirect_uris,
    ).toEqual([`${ROUTER}/auth/callback`]);
  });

  it("adds the webserver's callback, which catalog analysis uses", () => {
    expect(
      buildClientMetadataDocument({
        baseUrl: ROUTER,
        webserverPublicUrl: WEBSERVER,
      }).redirect_uris,
    ).toEqual([`${ROUTER}/auth/callback`, `${WEBSERVER}/oauth/callback`]);
  });

  it("strips trailing slashes so redirect_uris stay byte-equal to PUBLIC_URL", () => {
    expect(
      buildClientMetadataDocument({
        baseUrl: `${ROUTER}/`,
        webserverPublicUrl: `${WEBSERVER}/`,
      }).redirect_uris,
    ).toEqual([`${ROUTER}/auth/callback`, `${WEBSERVER}/oauth/callback`]);
  });

  it("describes a public client, with no secret", () => {
    const doc = buildClientMetadataDocument({ baseUrl: ROUTER });
    expect(doc.token_endpoint_auth_method).toBe("none");
    expect(doc.grant_types).toEqual(["authorization_code", "refresh_token"]);
    expect(doc.response_types).toEqual(["code"]);
  });
});

describe("clientMetadataDocumentSchema", () => {
  it("reads back what the builder produces", () => {
    const doc = buildClientMetadataDocument({
      baseUrl: ROUTER,
      webserverPublicUrl: WEBSERVER,
    });
    const parsed = clientMetadataDocumentSchema.safeParse(
      JSON.parse(JSON.stringify(doc)),
    );

    expect(parsed.success).toBe(true);
    expect(parsed.data?.redirect_uris).toEqual(doc.redirect_uris);
  });

  it("rejects a document missing the fields a reader needs", () => {
    expect(
      clientMetadataDocumentSchema.safeParse({ client_id: "x" }).success,
    ).toBe(false);
  });
});
