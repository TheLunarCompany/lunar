import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ServerCapabilitiesSections } from "./ServerDetailsModal";
import type { McpServer } from "@/types";
import { FeatureFlagsProvider } from "@/contexts/FeatureFlagsContext";
import { useFeatureFlags } from "@/contexts/feature-flags";

vi.mock("@/config/runtime-config", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/config/runtime-config")>();
  return {
    ...actual,
    isCapabilitiesEnabled: () => false,
    getRuntimeConfigSync: () => ({
      ...actual.getRuntimeConfigSync(),
      VITE_ENABLE_PERMISSIONS: "false",
      VITE_ENABLE_CAPABILITIES_UI: "false",
      VITE_UI_SIDEBAR_RESTRUCTURE: "false",
      VITE_SHOW_MCP_SERVERS: "false",
    }),
  };
});

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length(): number {
      return values.size;
    },
    clear(): void {
      values.clear();
    },
    getItem(key: string): string | null {
      return values.get(key) ?? null;
    },
    key(index: number): string | null {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key: string): void {
      values.delete(key);
    },
    setItem(key: string, value: string): void {
      values.set(key, value);
    },
  };
}

function ServerCapabilitiesHarness(): React.JSX.Element {
  const { setFeatureFlagOverride } = useFeatureFlags();

  return (
    <>
      <button
        type="button"
        onClick={() =>
          setFeatureFlagOverride("VITE_ENABLE_CAPABILITIES_UI", true)
        }
      >
        Enable capabilities
      </button>
      <ServerCapabilitiesSections server={server} />
    </>
  );
}

const server: McpServer = {
  args: [],
  command: "",
  id: "server-docs",
  name: "docs",
  status: "connected_stopped",
  tools: [
    {
      name: "search-docs",
      description: "Search docs.",
      invocations: 0,
    },
  ],
  prompts: [
    {
      name: "draft-docs-answer",
      description: "Draft an answer from docs.",
      invocations: 0,
    },
  ],
  usage: {
    callCount: 0,
  },
  type: "stdio",
};

describe("ServerCapabilitiesSections", () => {
  beforeEach(() => {
    vi.stubEnv("DEV", true);
    vi.stubGlobal("localStorage", createMemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("hides prompts when the capabilities UI flag is disabled", () => {
    render(
      <FeatureFlagsProvider>
        <ServerCapabilitiesSections server={server} />
      </FeatureFlagsProvider>,
    );

    expect(screen.getByText("Tools (1)")).toBeInTheDocument();
    expect(screen.queryByText("Prompts (1)")).toBeNull();
  });

  it("shows prompts immediately when the capabilities override is enabled", async () => {
    const user = userEvent.setup();
    render(
      <FeatureFlagsProvider>
        <ServerCapabilitiesHarness />
      </FeatureFlagsProvider>,
    );

    expect(screen.queryByText("Prompts (1)")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Enable capabilities" }),
    );

    expect(screen.getByText("Prompts (1)")).toBeInTheDocument();
  });
});
