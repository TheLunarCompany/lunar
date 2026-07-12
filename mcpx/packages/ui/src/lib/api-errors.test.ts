import { AxiosError } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./api";
import { getAddServerErrorMessage } from "./api-errors";

const STDIO_DISABLED_RESPONSE = {
  message:
    "This organization does not allow STDIO MCP servers. Contact your administrator for access.",
  error: {
    errorName: "NotAllowedError",
    errorMessage:
      "This organization does not allow STDIO MCP servers. Contact your administrator for access.",
  },
};

describe("mcpx API errors", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("preserves structured error data from add catalog server failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(STDIO_DISABLED_RESPONSE), {
            status: 403,
            statusText: "Forbidden",
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );

    await expect(
      apiClient.addCatalogServer("catalog-item-id", { envValues: {} }),
    ).rejects.toMatchObject({
      message: STDIO_DISABLED_RESPONSE.message,
      status: 403,
      responseData: STDIO_DISABLED_RESPONSE,
    });
  });

  it("accepts skill responses with an empty markdown body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              id: "0190a000-0000-7000-8000-000000000001",
              name: "empty-body",
              description: "Created before instructions are written.",
              body: "",
              exposeAsPrompt: true,
              author: {
                setupOwnerId: "owner-1",
                displayName: "Amir",
              },
              updatedAt: "2026-07-09T18:00:00.000Z",
            }),
            {
              status: 201,
              statusText: "Created",
              headers: { "Content-Type": "application/json" },
            },
          ),
      ),
    );

    await expect(
      apiClient.createSkill({
        name: "empty-body",
        description: "Created before instructions are written.",
        body: "",
        exposeAsPrompt: true,
      }),
    ).resolves.toMatchObject({
      name: "empty-body",
      body: "",
    });
  });

  it("uses the server message for add-server failures", () => {
    const serverResponse = {
      message: "Server supplied add-server error",
      error: {
        errorName: "NotAllowedError",
        errorMessage: "Server supplied add-server error",
      },
    };
    const error = Object.assign(new Error("Failed to add server"), {
      responseData: serverResponse,
    });

    expect(getAddServerErrorMessage(error)).toBe(serverResponse.message);
  });

  it("uses the server message from axios-style response data", () => {
    const error = new AxiosError(
      "Failed to add server",
      undefined,
      undefined,
      undefined,
      {
        data: {
          msg: "Axios-style server error",
        },
        status: 500,
        statusText: "Internal Server Error",
        headers: {},
        config: { headers: {} } as never,
      },
    );

    expect(getAddServerErrorMessage(error)).toBe("Axios-style server error");
  });
});
