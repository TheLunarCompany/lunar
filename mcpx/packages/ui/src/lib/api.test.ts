import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiClient } from "./api";

vi.mock("@/config/api-config", () => ({
  getAdminWebserverURL: vi.fn(),
  getMcpxServerURL: vi.fn(() => "https://mcpx.example"),
}));

describe("skill enablement API", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("gets and validates enabled skills", async () => {
    const enabled = [
      {
        subject: { kind: "consumerTag" as const, value: "reviewers" },
        skillIds: ["0190a000-0000-7000-8000-000000000001"],
      },
    ];
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ enabled }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(apiClient.getEnabledSkills()).resolves.toEqual(enabled);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://mcpx.example/skills/enabled",
      { credentials: "include" },
    );
  });

  it("rejects an invalid enabled skills response", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ enabled: [{ subject: {} }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(apiClient.getEnabledSkills()).rejects.toMatchObject({
      name: "ZodError",
    });
  });

  it("encodes every enablement path segment and accepts an empty PUT response", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(
      apiClient.enableSkill("skill/id?", {
        kind: "clientName",
        value: "agent/name?#",
      }),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://mcpx.example/skills/skill%2Fid%3F/enabled/clientName/agent%2Fname%3F%23",
      { method: "PUT", credentials: "include" },
    );
  });

  it("encodes every enablement path segment and accepts an empty DELETE response", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(
      apiClient.disableSkill("skill/id?", {
        kind: "consumerTag",
        value: "team/name?#",
      }),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://mcpx.example/skills/skill%2Fid%3F/enabled/consumerTag/team%2Fname%3F%23",
      { method: "DELETE", credentials: "include" },
    );
  });

  it("throws ApiError with the server message and status for non-2xx writes", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "Skill enablement denied" }), {
        status: 403,
        statusText: "Forbidden",
        headers: { "Content-Type": "application/json" },
      }),
    );

    const error = await apiClient
      .enableSkill("skill-id", { kind: "consumerTag", value: "reviewers" })
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      message: "Skill enablement denied",
      status: 403,
    });
  });
});
