import { setupServer } from "msw/node";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { handlers, resetMockApiState } from "./handlers";

const server = setupServer(...handlers);
const slackCatalogItemId = "018f6f21-5f3e-7b40-a84d-c276df5b9d91";
const playwrightCatalogItemId = "018f6f21-668f-7357-b1e5-7b3ba814d195";
const slackAnalysisId = "10000000-0000-4000-a000-000000000001";

describe("MSW handlers", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => resetMockApiState());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it("mocks approved capability reads with tools and prompts", async () => {
    const response = await fetch(
      `http://localhost:9000/catalog-items/${slackCatalogItemId}/approved-capabilities`,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      catalogItemId: slackCatalogItemId,
      approvedTools: ["channels.list", "chat.postMessage"],
      approvedPrompts: ["summarize-thread"],
    });
  });

  it("mocks approved capability replacement with omitted-key no-op semantics", async () => {
    const putResponse = await fetch(
      `http://localhost:9000/catalog-items/${slackCatalogItemId}/approved-capabilities`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: ["draft-release-note"] }),
      },
    );

    expect(putResponse.status).toBe(200);
    await expect(putResponse.json()).resolves.toEqual({
      catalogItemId: slackCatalogItemId,
      approvedTools: ["channels.list", "chat.postMessage"],
      approvedPrompts: ["draft-release-note"],
    });
  });

  it("mocks single-add and delete capability mutations", async () => {
    const addResponse = await fetch(
      `http://localhost:9000/catalog-items/${slackCatalogItemId}/approved-capabilities`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "prompt", name: "triage-incident" }),
      },
    );

    expect(addResponse.status).toBe(200);
    await expect(addResponse.json()).resolves.toMatchObject({
      approvedPrompts: ["summarize-thread", "triage-incident"],
    });

    const deleteResponse = await fetch(
      `http://localhost:9000/catalog-items/${slackCatalogItemId}/approved-capabilities/prompt/triage-incident`,
      { method: "DELETE" },
    );

    expect(deleteResponse.status).toBe(200);
    await expect(deleteResponse.json()).resolves.toMatchObject({
      approvedPrompts: ["summarize-thread"],
    });
  });

  it("mocks stdio-disabled target server creation for visual error testing", async () => {
    const response = await fetch(
      `http://localhost:9000/catalog-item/${playwrightCatalogItemId}/target-server`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ envValues: {} }),
      },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      message:
        "This organization does not allow STDIO MCP servers. Contact your administrator for access.",
      error: {
        errorName: "NotAllowedError",
        errorMessage:
          "This organization does not allow STDIO MCP servers. Contact your administrator for access.",
      },
    });
  });

  it("mocks prompt-aware sandbox analysis and enriched catalog item responses", async () => {
    const analysisResponse = await fetch(
      `http://localhost:9000/sandbox-analysis/${slackAnalysisId}`,
    );
    const defaultCatalogResponse = await fetch(
      "http://localhost:9000/default-catalog/items",
    );

    expect(analysisResponse.status).toBe(200);
    await expect(analysisResponse.json()).resolves.toMatchObject({
      id: slackAnalysisId,
      prompts: expect.arrayContaining([
        expect.objectContaining({
          name: "summarize-thread",
          arguments: expect.arrayContaining([
            expect.objectContaining({ name: "channelId", required: true }),
          ]),
        }),
      ]),
      tools: expect.arrayContaining([
        expect.objectContaining({ name: "channels.list" }),
      ]),
    });

    expect(defaultCatalogResponse.status).toBe(200);
    await expect(defaultCatalogResponse.json()).resolves.toEqual({
      items: expect.arrayContaining([
        expect.objectContaining({
          id: slackCatalogItemId,
          approvedPrompts: [{ promptName: "summarize-thread" }],
          approvedTools: [
            { toolName: "channels.list" },
            { toolName: "chat.postMessage" },
          ],
        }),
      ]),
    });
  });

  it("mocks list response wrappers from the implemented webserver schemas", async () => {
    const analysisListResponse = await fetch(
      "http://localhost:9000/sandbox-analysis",
    );
    const subCatalogItemsResponse = await fetch(
      "http://localhost:9000/sub-catalogs/00000000-0000-4000-a000-000000000001/items",
    );

    expect(analysisListResponse.status).toBe(200);
    await expect(analysisListResponse.json()).resolves.toEqual({
      analyses: expect.arrayContaining([
        expect.objectContaining({ id: slackAnalysisId }),
      ]),
    });

    expect(subCatalogItemsResponse.status).toBe(200);
    await expect(subCatalogItemsResponse.json()).resolves.toEqual({
      items: expect.arrayContaining([
        expect.objectContaining({ id: slackCatalogItemId }),
      ]),
    });
  });

  it("mocks catalog-level validation for curated catalog approved capabilities", async () => {
    const response = await fetch(
      `http://localhost:9000/default-catalog/items/${slackCatalogItemId}/approved-capabilities`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: ["channels.list"],
          prompt: ["not-org-approved"],
        }),
      },
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      message: "The following capabilities are not approved at catalog level",
      invalid: [{ type: "prompt", name: "not-org-approved" }],
    });
  });
});
