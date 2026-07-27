import {
  buildClientMetadataDocument,
  CLIENT_METADATA_PATH,
} from "./client-metadata.js";

const ORIGIN = "https://mcpx-stg.lunar.dev";

describe("buildClientMetadataDocument", () => {
  it("client_id equals the URL the document is served from", () => {
    // Servers reject the document when these disagree.
    expect(buildClientMetadataDocument(ORIGIN).client_id).toBe(
      `${ORIGIN}${CLIENT_METADATA_PATH}`,
    );
  });

  it("advertises the callbacks mcpx-server is sent back to", () => {
    expect(buildClientMetadataDocument(ORIGIN).redirect_uris).toEqual([
      `${ORIGIN}/auth/callback`,
    ]);
  });

  it("describes a public client, with no secret", () => {
    const doc = buildClientMetadataDocument(ORIGIN);
    expect(doc.token_endpoint_auth_method).toBe("none");
    expect(doc.grant_types).toEqual(["authorization_code", "refresh_token"]);
    expect(doc.response_types).toEqual(["code"]);
  });

  it("keeps every redirect_uri on the origin the document is served from", () => {
    // Servers match the flow's redirect_uri against this list, and the document
    // only ever speaks for its own origin.
    const doc = buildClientMetadataDocument(ORIGIN);
    expect(doc.redirect_uris.length).toBeGreaterThan(0);
    for (const uri of doc.redirect_uris) {
      expect(new URL(uri).origin).toBe(ORIGIN);
    }
  });
});
