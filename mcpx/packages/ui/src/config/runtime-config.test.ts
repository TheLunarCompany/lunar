import { afterEach, describe, expect, it, vi } from "vitest";

describe("runtime config feature helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("enables the skills page when the runtime flag is true", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          VITE_MCPX_SERVER_URL: "http://localhost:9000",
          VITE_SHOW_SKILLS_PAGE: "true",
        }),
      ),
    );
    const { isSkillsPageEnabled, loadRuntimeConfig } = await import(
      "./runtime-config"
    );

    await loadRuntimeConfig();

    expect(isSkillsPageEnabled()).toBe(true);
  });

  it("disables the skills page by default", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("missing"));
    const { isSkillsPageEnabled, loadRuntimeConfig } = await import(
      "./runtime-config"
    );

    await loadRuntimeConfig();

    expect(isSkillsPageEnabled()).toBe(false);
  });
});
