import { afterEach, describe, expect, it, vi } from "vitest";

describe("runtime config feature helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("shows MCP Servers when the runtime flag is true", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          VITE_MCPX_SERVER_URL: "http://localhost:9523",
          VITE_SHOW_MCP_SERVERS: "true",
        }),
      ),
    );
    const { isMcpServersShown, loadRuntimeConfig } = await import(
      "./runtime-config"
    );

    await loadRuntimeConfig();

    expect(isMcpServersShown()).toBe(true);
  });

  it("disables Pendo by default", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ VITE_MCPX_SERVER_URL: "http://localhost:9523" }),
      ),
    );
    const { isPendoEnabled, loadRuntimeConfig } = await import(
      "./runtime-config"
    );

    await loadRuntimeConfig();

    expect(isPendoEnabled()).toBe(false);
  });

  it("enables Pendo only when both runtime gates are true", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          VITE_MCPX_SERVER_URL: "http://localhost:9523",
          VITE_ENABLE_PENDO: "true",
          VITE_IS_BOOMI: "true",
        }),
      ),
    );
    const { isPendoEnabled, loadRuntimeConfig } = await import(
      "./runtime-config"
    );

    await loadRuntimeConfig();

    expect(isPendoEnabled()).toBe(true);
  });

  it("keeps Pendo disabled when the Boomi gate is false", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          VITE_MCPX_SERVER_URL: "http://localhost:9523",
          VITE_ENABLE_PENDO: "true",
          VITE_IS_BOOMI: "false",
        }),
      ),
    );
    const { isPendoEnabled, loadRuntimeConfig } = await import(
      "./runtime-config"
    );

    await loadRuntimeConfig();

    expect(isPendoEnabled()).toBe(false);
  });

  it("hides MCP Servers by default", async () => {
    vi.stubEnv("VITE_SHOW_MCP_SERVERS", "false");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("missing"));
    const { isMcpServersShown, loadRuntimeConfig } = await import(
      "./runtime-config"
    );

    await loadRuntimeConfig();

    expect(isMcpServersShown()).toBe(false);
  });

  it("enables the sidebar restructure when the runtime flag is true", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          VITE_MCPX_SERVER_URL: "http://localhost:9523",
          VITE_UI_SIDEBAR_RESTRUCTURE: "true",
        }),
      ),
    );
    const { isUiSidebarRestructureEnabled, loadRuntimeConfig } = await import(
      "./runtime-config"
    );

    await loadRuntimeConfig();

    expect(isUiSidebarRestructureEnabled()).toBe(true);
  });

  it("disables the sidebar restructure by default", async () => {
    vi.stubEnv("VITE_UI_SIDEBAR_RESTRUCTURE", "false");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("missing"));
    const { isUiSidebarRestructureEnabled, loadRuntimeConfig } = await import(
      "./runtime-config"
    );

    await loadRuntimeConfig();

    expect(isUiSidebarRestructureEnabled()).toBe(false);
  });
});
