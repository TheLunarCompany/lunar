import {
  buildClientMetadataDocument,
  clientMetadataDocumentSchema,
  CLIENT_METADATA_PATH,
} from "./client-metadata.js";

const MCPX_URL = "https://mcpx-stg.lunar.dev";

describe("buildClientMetadataDocument", () => {
  it("client_id equals the URL the document is served from", () => {
    // Servers reject the document when these disagree.
    expect(buildClientMetadataDocument({ baseUrl: MCPX_URL }).client_id).toBe(
      `${MCPX_URL}${CLIENT_METADATA_PATH}`,
    );
  });

  it("advertises only the MCPX callback, which every flow is sent back to", () => {
    expect(
      buildClientMetadataDocument({ baseUrl: MCPX_URL }).redirect_uris,
    ).toEqual([`${MCPX_URL}/auth/callback`]);
  });

  it("strips trailing slashes so the redirect_uri stays byte-equal", () => {
    expect(
      buildClientMetadataDocument({ baseUrl: `${MCPX_URL}/` }).redirect_uris,
    ).toEqual([`${MCPX_URL}/auth/callback`]);
  });

  it("describes a public client, with no secret", () => {
    const doc = buildClientMetadataDocument({ baseUrl: MCPX_URL });
    expect(doc.token_endpoint_auth_method).toBe("none");
    expect(doc.grant_types).toEqual(["authorization_code", "refresh_token"]);
    expect(doc.response_types).toEqual(["code"]);
  });
});

describe("clientMetadataDocumentSchema", () => {
  it("reads back what the builder produces", () => {
    const doc = buildClientMetadataDocument({ baseUrl: MCPX_URL });
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
