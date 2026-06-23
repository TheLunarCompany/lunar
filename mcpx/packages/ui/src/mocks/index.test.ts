import { afterEach, describe, expect, it, vi } from "vitest";

async function loadMocks({
  mswEnabled = false,
  toolsPageMockEnabled = false,
}: {
  mswEnabled?: boolean;
  toolsPageMockEnabled?: boolean;
}) {
  vi.resetModules();
  vi.stubEnv("VITE_MSW_ENABLED", mswEnabled ? "true" : "false");

  const start = vi.fn().mockResolvedValue(undefined);
  const seedToolsPageMockState = vi.fn();

  vi.doMock("./browser", () => ({
    worker: { start },
  }));
  vi.doMock("./tools-page/config", () => ({
    isToolsPageMockEnabled: toolsPageMockEnabled,
  }));
  vi.doMock("./tools-page/seed-state", () => ({
    seedToolsPageMockState,
  }));

  const mocks = await import("./index");

  return { ...mocks, seedToolsPageMockState, start };
}

describe("enableMocks", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.restoreAllMocks();
    window.__MSW_ENABLED__ = undefined;
  });

  it("starts the MSW worker when MSW mocks are enabled", async () => {
    const { enableMocks, start } = await loadMocks({ mswEnabled: true });

    await enableMocks();

    expect(start).toHaveBeenCalledWith({ onUnhandledRequest: "bypass" });
    expect(window.__MSW_ENABLED__).toBe(true);
  });

  it("seeds the Tools page state when the Tools page mock is enabled", async () => {
    const { enableMocks, seedToolsPageMockState, start } = await loadMocks({
      toolsPageMockEnabled: true,
    });

    await enableMocks();

    expect(start).not.toHaveBeenCalled();
    expect(seedToolsPageMockState).toHaveBeenCalledOnce();
  });
});
