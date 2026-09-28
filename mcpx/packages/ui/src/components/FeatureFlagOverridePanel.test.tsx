import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RuntimeConfig } from "@/config/runtime-config";
import { FeatureFlagsProvider } from "@/contexts/FeatureFlagsContext";
import { FeatureFlagOverridePanel } from "./FeatureFlagOverridePanel";

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

function renderPanel(): void {
  render(
    <FeatureFlagsProvider>
      <FeatureFlagOverridePanel />
    </FeatureFlagsProvider>,
  );
}

describe("FeatureFlagOverridePanel", () => {
  beforeEach(() => {
    vi.stubEnv("DEV", true);
    vi.stubGlobal("localStorage", createMemoryStorage());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("renders the development pill collapsed by default", () => {
    renderPanel();

    expect(screen.getByRole("button", { name: "Dev flags" })).toBeVisible();
    expect(
      screen.queryByText("VITE_ENABLE_PERMISSIONS"),
    ).not.toBeInTheDocument();
  });

  it("opens and closes only when its trigger is used", async () => {
    const user = userEvent.setup();
    render(
      <FeatureFlagsProvider>
        <button type="button">Background</button>
        <FeatureFlagOverridePanel />
      </FeatureFlagsProvider>,
    );
    const trigger = screen.getByRole("button", { name: "Dev flags" });

    await user.click(trigger);
    expect(screen.getByText("VITE_ENABLE_PERMISSIONS")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Background" }));
    expect(screen.getByText("VITE_ENABLE_PERMISSIONS")).toBeVisible();

    await user.click(trigger);
    expect(
      screen.queryByText("VITE_ENABLE_PERMISSIONS"),
    ).not.toBeInTheDocument();
  });

  it("opens from the keyboard trigger", async () => {
    const user = userEvent.setup();
    renderPanel();
    const trigger = screen.getByRole("button", { name: "Dev flags" });

    await user.tab();
    expect(trigger).toHaveFocus();

    await user.keyboard("{Enter}");

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("VITE_ENABLE_PERMISSIONS")).toBeVisible();
  });

  it("renders the four approved flags with inherited values", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: "Dev flags" }));

    expect(screen.getAllByRole("switch")).toHaveLength(4);
    expect(
      screen.getByRole("switch", { name: "VITE_ENABLE_PERMISSIONS" }),
    ).toHaveAttribute("data-state", "checked");
    expect(
      screen.getByRole("switch", {
        name: "VITE_ENABLE_CAPABILITIES_UI",
      }),
    ).toHaveAttribute("data-state", "unchecked");
    expect(screen.getAllByText("Inherited")).toHaveLength(4);
    expect(screen.getByRole("button", { name: "Reset all" })).toBeDisabled();
  });

  it("applies a local override from a switch", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("button", { name: "Dev flags" }));

    await user.click(
      screen.getByRole("switch", {
        name: "VITE_ENABLE_CAPABILITIES_UI",
      }),
    );

    expect(screen.getByText("Override")).toBeVisible();
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual({
      VITE_ENABLE_CAPABILITIES_UI: true,
    });
    expect(screen.getByRole("button", { name: "Reset all" })).toBeEnabled();
  });

  it("resets every local override", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ VITE_ENABLE_CAPABILITIES_UI: true }),
    );
    renderPanel();
    await user.click(screen.getByRole("button", { name: "Dev flags" }));

    await user.click(screen.getByRole("button", { name: "Reset all" }));

    expect(screen.getAllByText("Inherited")).toHaveLength(4);
    expect(
      screen.getByRole("switch", {
        name: "VITE_ENABLE_CAPABILITIES_UI",
      }),
    ).toHaveAttribute("data-state", "unchecked");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("does not render outside development", () => {
    vi.stubEnv("DEV", false);

    renderPanel();

    expect(
      screen.queryByRole("button", { name: "Dev flags" }),
    ).not.toBeInTheDocument();
  });
});
