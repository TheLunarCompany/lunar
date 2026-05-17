import { beforeEach, describe, expect, it } from "vitest";
import { socketStore } from "@/store/socket";
import { toolsStore } from "@/store/tools";
import { seedToolsPageMockState } from "./seed-state";

describe("seedToolsPageMockState", () => {
  beforeEach(() => {
    window.__MCPX_TEST_MODE__ = false;
    socketStore.setState({
      appConfig: null,
      isConnected: false,
      isPending: true,
      serializedAppConfig: null,
      systemState: null,
    });
    toolsStore.setState({ customTools: [], tools: [] });
  });

  it("seeds socket and tools state for the tools page dev mock", () => {
    seedToolsPageMockState();

    const state = socketStore.getState();

    expect(window.__MCPX_TEST_MODE__).toBe(true);
    expect(state.isConnected).toBe(true);
    expect(state.isPending).toBe(false);
    expect(state.serializedAppConfig).toEqual(
      expect.objectContaining({
        yaml: expect.any(String),
        version: 1,
      }),
    );
    expect(
      state.systemState?.targetServers.map((server) => server.name),
    ).toEqual([
      "figma-community",
      "playwright",
      "launchdarkly",
      "context7",
      "atlassian",
      "notion",
      "linear",
    ]);

    const playwrightServer = state.systemState?.targetServers.find(
      (server) => server.name === "playwright",
    );
    expect(playwrightServer?.originalTools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          annotations: expect.objectContaining({ destructiveHint: true }),
          name: "browser_run_code_unsafe",
        }),
        expect.objectContaining({
          annotations: expect.objectContaining({ readOnlyHint: true }),
          name: "browser_network_requests",
        }),
      ]),
    );

    const figmaServer = state.systemState?.targetServers.find(
      (server) => server.name === "figma-community",
    );
    expect(figmaServer?.originalTools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          annotations: { openWorldHint: true },
          name: "download_figma_images",
        }),
      ]),
    );

    const context7Server = state.systemState?.targetServers.find(
      (server) => server.name === "context7",
    );
    expect(context7Server?.state.type).toBe("pending-input");

    const atlassianServer = state.systemState?.targetServers.find(
      (server) => server.name === "atlassian",
    );
    expect(atlassianServer?.state.type).toBe("pending-auth");

    const notionServer = state.systemState?.targetServers.find(
      (server) => server.name === "notion",
    );
    expect(notionServer?.state.type).toBe("pending-auth");

    const linearServer = state.systemState?.targetServers.find(
      (server) => server.name === "linear",
    );
    expect(linearServer?.state).toEqual(
      expect.objectContaining({
        type: "connection-failed",
        error: expect.any(Error),
      }),
    );

    expect(state.appConfig?.toolGroups).toEqual(
      expect.arrayContaining([
        {
          name: "LaunchDarkly Read",
          services: {
            launchdarkly: ["get-code-references", "list-feature-flags"],
          },
        },
        {
          name: "Browser Inspection",
          services: {
            playwright: [
              "browser_console_messages",
              "browser_network_requests",
              "browser_take_screenshot",
            ],
          },
        },
      ]),
    );
    expect(toolsStore.getState().tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "get-code-references",
          serviceName: "launchdarkly",
        }),
        expect.objectContaining({
          name: "browser_console_messages",
          serviceName: "playwright",
        }),
      ]),
    );
    expect(toolsStore.getState().customTools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "list-production-flags",
          originalTool: expect.objectContaining({ name: "list-feature-flags" }),
        }),
      ]),
    );
  });
});
