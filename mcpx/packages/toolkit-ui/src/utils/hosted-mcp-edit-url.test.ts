import {
  buildHostedMcpEditUrl,
  HOSTED_MCP_EDIT_PARAM,
  HOSTED_RETURN_URL_PARAM,
  HOSTED_SPACE_ID_PARAM,
  parseHostedMcpEditContext,
} from "./hosted-mcp-edit-url.js";

describe("hosted MCP edit URL utilities", () => {
  describe("buildHostedMcpEditUrl", () => {
    it("adds hosted edit parameters to an absolute MCPX UI URL", () => {
      expect(
        buildHostedMcpEditUrl({
          targetUrl: "https://mcpx-ui-stg.lunar.dev/",
          spaceId: "space-123",
          returnUrl: "https://mcpx-admin-stg.lunar.dev/hosted-mcp-server",
        }),
      ).toBe(
        "https://mcpx-ui-stg.lunar.dev/?hostedMcpEdit=true&hostedSpaceId=space-123&returnUrl=https%3A%2F%2Fmcpx-admin-stg.lunar.dev%2Fhosted-mcp-server",
      );
    });

    it("preserves existing query parameters", () => {
      expect(
        buildHostedMcpEditUrl({
          targetUrl: "https://mcpx-ui-stg.lunar.dev/?tab=catalog",
          spaceId: "space-123",
          returnUrl: "https://mcpx-admin-stg.lunar.dev/hosted-mcp-server",
        }),
      ).toBe(
        "https://mcpx-ui-stg.lunar.dev/?tab=catalog&hostedMcpEdit=true&hostedSpaceId=space-123&returnUrl=https%3A%2F%2Fmcpx-admin-stg.lunar.dev%2Fhosted-mcp-server",
      );
    });

    it("rejects relative MCPX UI URLs", () => {
      expect(() =>
        buildHostedMcpEditUrl({
          targetUrl: "/dashboard",
          spaceId: "space-123",
          returnUrl: "https://mcpx-admin-stg.lunar.dev/hosted-mcp-server",
        }),
      ).toThrow("Invalid URL");
    });
  });

  describe("parseHostedMcpEditContext", () => {
    it("returns hosted edit context from hosted edit URL parameters", () => {
      expect(
        parseHostedMcpEditContext(
          new URLSearchParams({
            [HOSTED_MCP_EDIT_PARAM]: "true",
            [HOSTED_SPACE_ID_PARAM]: "space-123",
            [HOSTED_RETURN_URL_PARAM]:
              "https://mcpx-admin-stg.lunar.dev/hosted-mcp-server",
          }),
        ),
      ).toEqual({
        spaceId: "space-123",
        returnUrl: "https://mcpx-admin-stg.lunar.dev/hosted-mcp-server",
      });
    });

    it("accepts a search string with a leading question mark", () => {
      expect(
        parseHostedMcpEditContext(
          "?hostedMcpEdit=true&hostedSpaceId=space-123&returnUrl=https%3A%2F%2Fmcpx-admin-stg.lunar.dev%2Fhosted-mcp-server",
        ),
      ).toEqual({
        spaceId: "space-123",
        returnUrl: "https://mcpx-admin-stg.lunar.dev/hosted-mcp-server",
      });
    });

    it("drops unsafe return URLs", () => {
      expect(
        parseHostedMcpEditContext(
          new URLSearchParams({
            [HOSTED_MCP_EDIT_PARAM]: "true",
            [HOSTED_SPACE_ID_PARAM]: "space-123",
            [HOSTED_RETURN_URL_PARAM]: "javascript:alert(1)",
          }),
        ),
      ).toEqual({
        spaceId: "space-123",
        returnUrl: null,
      });
    });

    it("keeps custom-domain admin return URLs", () => {
      expect(
        parseHostedMcpEditContext(
          new URLSearchParams({
            [HOSTED_MCP_EDIT_PARAM]: "true",
            [HOSTED_SPACE_ID_PARAM]: "space-123",
            [HOSTED_RETURN_URL_PARAM]: "https://example.com/hosted-mcp-server",
          }),
        ),
      ).toEqual({
        spaceId: "space-123",
        returnUrl: "https://example.com/hosted-mcp-server",
      });
    });

    it("returns null when the hosted edit flag is missing", () => {
      expect(
        parseHostedMcpEditContext(
          new URLSearchParams({ [HOSTED_SPACE_ID_PARAM]: "space-123" }),
        ),
      ).toBeNull();
    });

    it("returns null when the hosted space id is missing", () => {
      expect(
        parseHostedMcpEditContext(
          new URLSearchParams({ [HOSTED_MCP_EDIT_PARAM]: "true" }),
        ),
      ).toBeNull();
    });

    it("returns null when the hosted edit flag is not exactly true", () => {
      expect(
        parseHostedMcpEditContext(
          new URLSearchParams({
            [HOSTED_MCP_EDIT_PARAM]: "1",
            [HOSTED_SPACE_ID_PARAM]: "space-123",
          }),
        ),
      ).toBeNull();
    });
  });
});
