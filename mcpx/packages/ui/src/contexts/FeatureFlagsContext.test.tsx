import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RuntimeConfig } from "@/config/runtime-config";
import { FeatureFlagsProvider } from "./FeatureFlagsContext";
import { useFeatureFlags } from "./feature-flags";

const STORAGE_KEY = "mcpx-ui:config-overrides";

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

const runtimeConfig: RuntimeConfig = {
  VITE_MCPX_SERVER_URL: "http://localhost:9000",
  VITE_MCPX_SERVER_PORT: "9000",
  VITE_WS_URL: "ws://localhost:9000",
  VITE_AUTH0_DOMAIN: "example.auth0.com",
  VITE_AUTH0_CLIENT_ID: "client-id",
  VITE_AUTH0_AUDIENCE: "mcpx-webapp",
  VITE_ENABLE_LOGIN: "false",
  VITE_ENABLE_ENTERPRISE: "false",
  VITE_OAUTH_CALLBACK_BASE_URL: "http://localhost:5173/oauth/callback",
  VITE_AUTH_BFF_URL: "http://localhost:3002",
  VITE_ADMIN_WEBSERVER_URL: "http://localhost:3000",
  VITE_ENABLE_PERMISSIONS: "true",
  VITE_ENABLE_CAPABILITIES_UI: "false",
  VITE_ADD_SERVER_CHECKBOX: "Add another server",
  VITE_UI_SIDEBAR_RESTRUCTURE: "false",
  VITE_SHOW_MCP_SERVERS: "false",
};

vi.mock("@/config/runtime-config", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/config/runtime-config")>();

  return {
    ...actual,
    getRuntimeConfigSync: () => runtimeConfig,
  };
});

function FeatureFlagHarness(): React.JSX.Element {
  const {
    featureFlags,
    setFeatureFlagOverride,
    resetFeatureFlagOverride,
    resetFeatureFlagOverrides,
    isFeatureFlagOverridden,
  } = useFeatureFlags();

  return (
    <>
      {Object.entries(featureFlags).map(([key, enabled]) => (
        <p key={key} data-testid={key}>
          {String(enabled)}:
          {isFeatureFlagOverridden(key as keyof typeof featureFlags)
            ? "override"
            : "inherited"}
        </p>
      ))}
      <button
        type="button"
        onClick={() =>
          setFeatureFlagOverride("VITE_ENABLE_CAPABILITIES_UI", true)
        }
      >
        Enable capabilities
      </button>
      <button
        type="button"
        onClick={() => resetFeatureFlagOverride("VITE_ENABLE_CAPABILITIES_UI")}
      >
        Reset capabilities
      </button>
      <button type="button" onClick={resetFeatureFlagOverrides}>
        Reset all
      </button>
    </>
  );
}

function renderHarness(): void {
  render(
    <FeatureFlagsProvider>
      <FeatureFlagHarness />
    </FeatureFlagsProvider>,
  );
}

describe("FeatureFlagsProvider", () => {
  beforeEach(() => {
    vi.stubEnv("DEV", true);
    vi.stubGlobal("localStorage", createMemoryStorage());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("exposes inherited runtime feature flags", () => {
    renderHarness();

    expect(screen.getByTestId("VITE_ENABLE_PERMISSIONS")).toHaveTextContent(
      "true:inherited",
    );
    expect(screen.getByTestId("VITE_ENABLE_CAPABILITIES_UI")).toHaveTextContent(
      "false:inherited",
    );
  });

  it("applies valid stored overrides and removes invalid entries", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        VITE_ENABLE_CAPABILITIES_UI: true,
        VITE_SHOW_MCP_SERVERS: "true",
        VITE_ENABLE_LOGIN: true,
      }),
    );

    renderHarness();

    expect(screen.getByTestId("VITE_ENABLE_CAPABILITIES_UI")).toHaveTextContent(
      "true:override",
    );
    expect(screen.getByTestId("VITE_SHOW_MCP_SERVERS")).toHaveTextContent(
      "false:inherited",
    );
    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual({
        VITE_ENABLE_CAPABILITIES_UI: true,
      });
    });
  });

  it("sets and resets one local override", async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(
      screen.getByRole("button", { name: "Enable capabilities" }),
    );

    expect(screen.getByTestId("VITE_ENABLE_CAPABILITIES_UI")).toHaveTextContent(
      "true:override",
    );
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual({
      VITE_ENABLE_CAPABILITIES_UI: true,
    });

    await user.click(
      screen.getByRole("button", { name: "Reset capabilities" }),
    );

    expect(screen.getByTestId("VITE_ENABLE_CAPABILITIES_UI")).toHaveTextContent(
      "false:inherited",
    );
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("resets all local overrides", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        VITE_ENABLE_CAPABILITIES_UI: true,
        VITE_SHOW_MCP_SERVERS: true,
      }),
    );
    renderHarness();

    await user.click(screen.getByRole("button", { name: "Reset all" }));

    expect(screen.getByTestId("VITE_ENABLE_CAPABILITIES_UI")).toHaveTextContent(
      "false:inherited",
    );
    expect(screen.getByTestId("VITE_SHOW_MCP_SERVERS")).toHaveTextContent(
      "false:inherited",
    );
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("removes malformed stored JSON", async () => {
    window.localStorage.setItem(STORAGE_KEY, "not-json");

    renderHarness();

    expect(screen.getByTestId("VITE_ENABLE_CAPABILITIES_UI")).toHaveTextContent(
      "false:inherited",
    );
    await waitFor(() => {
      expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  it("keeps in-memory overrides when storage is unavailable", async () => {
    const user = userEvent.setup();
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    renderHarness();

    await user.click(
      screen.getByRole("button", { name: "Enable capabilities" }),
    );

    expect(screen.getByTestId("VITE_ENABLE_CAPABILITIES_UI")).toHaveTextContent(
      "true:override",
    );
  });

  it("ignores stored overrides and does not write outside development", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ VITE_ENABLE_CAPABILITIES_UI: true }),
    );
    vi.stubEnv("DEV", false);
    const setItem = vi.spyOn(window.localStorage, "setItem");

    renderHarness();

    expect(screen.getByTestId("VITE_ENABLE_CAPABILITIES_UI")).toHaveTextContent(
      "false:inherited",
    );
    expect(setItem).not.toHaveBeenCalled();
  });
});
