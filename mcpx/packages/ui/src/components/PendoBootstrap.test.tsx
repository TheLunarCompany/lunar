import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  installPendo,
  PENDO_EVENTS,
  preparePendo,
  trackPendoEvent,
} from "./pendo";

const harness = vi.hoisted(() => ({
  email: "user@example.com",
  authenticated: true,
  authLoading: false,
  accountQuery: {
    data: { accountId: "account-1" } as
      | { accountId: string }
      | null
      | undefined,
    isPending: false,
    isFetching: false,
    isError: false,
  },
}));

vi.mock("@/config/runtime-config", () => ({
  isPendoEnabled: () => true,
}));

vi.mock("@/hooks/useBoomiAccount", () => ({
  useBoomiAccount: () => harness.accountQuery,
}));

vi.mock("@/contexts/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: harness.email, userType: "user" },
    isAuthenticated: harness.authenticated,
    loading: harness.authLoading,
  }),
}));

vi.mock("@/pages/Dashboard", async () => {
  const { useEffect } = await import("react");
  return {
    default: () => {
      useEffect(() => {
        trackPendoEvent(PENDO_EVENTS.dashboardViewed);
      }, []);
      return null;
    },
  };
});

afterEach(() => {
  document.getElementById("boomi-pendo-sdk")?.remove();
  delete window.pendo;
  harness.email = "user@example.com";
  harness.authenticated = true;
  harness.authLoading = false;
  harness.accountQuery = {
    data: { accountId: "account-1" },
    isPending: false,
    isFetching: false,
    isError: false,
  };
});

describe("PendoBootstrap", () => {
  it("loads the approved async SDK and queues the identity", () => {
    installPendo("user@example.com", "account-1");

    const script = document.getElementById(
      "boomi-pendo-sdk",
    ) as HTMLScriptElement;
    expect(script.async).toBe(true);
    expect(script.src).toBe(
      "https://content.engagement.boomi.com/agent/static/6f621fb5-a115-4088-7d59-9bad314c05dd/pendo.js",
    );
    expect(window.pendo?._q).toContainEqual([
      "initialize",
      { visitor: { id: "user@example.com" }, account: { id: "account-1" } },
    ]);
  });

  it("does not install duplicate scripts for the same identity", () => {
    installPendo("user@example.com", "account-1");
    installPendo("user@example.com", "account-1");

    expect(document.querySelectorAll("#boomi-pendo-sdk")).toHaveLength(1);
  });

  it("queues events before the SDK is ready without throwing", () => {
    preparePendo();

    expect(() => trackPendoEvent(PENDO_EVENTS.dashboardViewed)).not.toThrow();
    expect(window.pendo?._q).toContainEqual([
      "track",
      PENDO_EVENTS.dashboardViewed,
    ]);
  });

  it("does not initialize with empty identity values", () => {
    installPendo("", "account-1");
    installPendo("user@example.com", "");

    expect(document.getElementById("boomi-pendo-sdk")).toBeNull();
  });

  it("skips initialization when the email is missing", async () => {
    harness.email = "";
    const { PendoBootstrap } = await import("./PendoBootstrap");

    render(<PendoBootstrap />);

    expect(document.getElementById("boomi-pendo-sdk")).toBeNull();
    expect(window.pendo).toBeUndefined();
  });

  it("skips initialization when the account ID is missing", async () => {
    harness.accountQuery.data = null;
    const { PendoBootstrap } = await import("./PendoBootstrap");

    render(<PendoBootstrap />);

    expect(document.getElementById("boomi-pendo-sdk")).toBeNull();
    expect(window.pendo).toBeUndefined();
  });

  it("identifies a changed session account without adding another SDK script", async () => {
    const { PendoBootstrap } = await import("./PendoBootstrap");
    const { rerender } = render(<PendoBootstrap />);
    harness.accountQuery.data = { accountId: "account-2" };

    rerender(<PendoBootstrap />);

    expect(document.querySelectorAll("#boomi-pendo-sdk")).toHaveLength(1);
    expect(window.pendo?._q).toContainEqual([
      "identify",
      {
        visitor: { id: "user@example.com" },
        account: { id: "account-2" },
      },
    ]);
  });

  it("suspends while the account query is refreshing and resumes for a changed account", async () => {
    const { PendoBootstrap } = await import("./PendoBootstrap");
    const { rerender } = render(<PendoBootstrap />);
    harness.accountQuery.isFetching = true;

    rerender(<PendoBootstrap />);

    expect(window.pendo?._q).toContainEqual([
      "clearSession",
      { doNotTrack: true },
    ]);
    harness.accountQuery.isFetching = false;
    harness.accountQuery.data = { accountId: "account-2" };

    rerender(<PendoBootstrap />);

    expect(window.pendo?._q).toContainEqual([
      "identify",
      {
        visitor: { id: "user@example.com" },
        account: { id: "account-2" },
      },
    ]);
    expect(window.pendo?._q).toContainEqual(["startSendingEvents"]);
  });

  it("keeps a page-view queued during the initial account lookup", async () => {
    harness.accountQuery.data = undefined;
    harness.accountQuery.isPending = true;
    const { PendoBootstrap } = await import("./PendoBootstrap");
    const { default: Dashboard } = await import("@/pages/Dashboard");
    const { rerender } = render(
      <>
        <PendoBootstrap />
        <Dashboard />
      </>,
    );

    expect(window.pendo?._q).toContainEqual([
      "track",
      PENDO_EVENTS.dashboardViewed,
    ]);
    expect(document.getElementById("boomi-pendo-sdk")).toBeNull();

    harness.accountQuery.data = { accountId: "account-1" };
    harness.accountQuery.isPending = false;
    rerender(
      <>
        <PendoBootstrap />
        <Dashboard />
      </>,
    );

    expect(window.pendo?._q).toContainEqual([
      "initialize",
      { visitor: { id: "user@example.com" }, account: { id: "account-1" } },
    ]);
    expect(window.pendo?._q).toContainEqual([
      "track",
      PENDO_EVENTS.dashboardViewed,
    ]);
    expect(document.getElementById("boomi-pendo-sdk")).not.toBeNull();
  });

  it("keeps a local queue without loading the SDK while the account request is pending", async () => {
    harness.accountQuery.data = undefined;
    harness.accountQuery.isPending = true;
    const { PendoBootstrap } = await import("./PendoBootstrap");

    render(<PendoBootstrap />);

    expect(window.pendo?._q).toEqual([]);
    expect(document.getElementById("boomi-pendo-sdk")).toBeNull();
  });

  it("clears the local queue when the account is missing after loading", async () => {
    harness.accountQuery.data = undefined;
    harness.accountQuery.isPending = true;
    const { PendoBootstrap } = await import("./PendoBootstrap");
    const { rerender } = render(<PendoBootstrap />);
    trackPendoEvent(PENDO_EVENTS.dashboardViewed);

    harness.accountQuery.isPending = false;
    rerender(<PendoBootstrap />);

    expect(window.pendo?._q).toEqual([]);
    expect(document.getElementById("boomi-pendo-sdk")).toBeNull();
  });

  it("suspends after logout", async () => {
    const { PendoBootstrap } = await import("./PendoBootstrap");
    const { rerender } = render(<PendoBootstrap />);
    harness.authenticated = false;

    rerender(<PendoBootstrap />);

    expect(window.pendo?._q).toContainEqual([
      "clearSession",
      { doNotTrack: true },
    ]);
  });

  it("keeps the bootstrap component non-visual", async () => {
    const { PendoBootstrap } = await import("./PendoBootstrap");
    const { container } = render(<PendoBootstrap />);

    expect(container).toBeEmptyDOMElement();
  });
});
