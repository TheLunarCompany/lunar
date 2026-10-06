import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McpxProbeState } from "@/hooks/useMcpxProbe";
import { AuthenticatedLayoutRoute } from "./app-route-components";

const mocks = vi.hoisted(() => ({
  auth: { loginRequired: true, isAuthenticated: true, loading: false },
  probe: {
    state: { type: "checking" } as McpxProbeState,
    refresh: vi.fn(),
  },
  connectError: false,
}));

vi.mock("@/hooks/useMcpxProbe", () => ({
  useMcpxProbe: () => mocks.probe,
}));
vi.mock("@/store", () => ({
  useSocketStore: (selector: (state: unknown) => unknown) =>
    selector({ connectError: mocks.connectError }),
}));
vi.mock("@/contexts/useAuth", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/mocks/tools-page/config", () => ({ isToolsPageMockEnabled: false }));
vi.mock("@/components/ConnectionManager", () => ({
  ConnectionManager: ({ enabled }: { enabled: boolean }) => (
    <div data-testid="connection-manager" data-enabled={enabled} />
  ),
}));
vi.mock("@/components/layout/Layout", () => ({
  Layout: ({
    children,
    probeState,
  }: {
    children: ReactNode;
    probeState: McpxProbeState;
  }) => (
    <div data-testid="layout" data-probe-state={probeState.type}>
      {children}
    </div>
  ),
}));
vi.mock("@/components/LoadingScreen", () => ({
  default: () => <div>Loading</div>,
}));
vi.mock("@/components/EnterpriseLoginScreen", () => ({
  default: () => <div>Login</div>,
}));
vi.mock("@/components/UnauthorizedScreen", () => ({
  default: ({ message }: { message: string }) => <div>Denied: {message}</div>,
}));

describe("AuthenticatedLayoutRoute", () => {
  beforeEach(() => {
    Object.assign(mocks.auth, {
      loginRequired: true,
      isAuthenticated: true,
      loading: false,
    });
    mocks.probe.state = { type: "checking" };
    mocks.probe.refresh.mockClear();
    mocks.connectError = false;
  });

  it("keeps SSO screens outside the app layout", () => {
    mocks.auth.loading = true;
    const rendered = renderRoute();
    expect(screen.getByText("Loading")).toBeInTheDocument();

    mocks.auth.loading = false;
    mocks.auth.isAuthenticated = false;
    rendered.rerender(routeTree());
    expect(screen.getByText("Login")).toBeInTheDocument();
  });

  it("renders authorization failures outside the app layout", () => {
    mocks.probe.state = { type: "unauthorized", message: "Access denied" };

    renderRoute();

    expect(screen.getByText("Denied: Access denied")).toBeInTheDocument();
    expect(screen.queryByTestId("layout")).not.toBeInTheDocument();
  });

  it("enables the socket only when the probe is ready", () => {
    const rendered = renderRoute();
    expect(screen.getByTestId("connection-manager")).toHaveAttribute(
      "data-enabled",
      "false",
    );

    mocks.probe.state = { type: "ready" };
    rendered.rerender(routeTree());
    expect(screen.getByTestId("connection-manager")).toHaveAttribute(
      "data-enabled",
      "true",
    );
  });

  it("refreshes the probe after a transport failure", async () => {
    mocks.probe.state = { type: "ready" };
    mocks.connectError = true;

    renderRoute();

    await waitFor(() => expect(mocks.probe.refresh).toHaveBeenCalledOnce());
  });
});

function routeTree() {
  return (
    <MemoryRouter>
      <Routes>
        <Route element={<AuthenticatedLayoutRoute />}>
          <Route index element={<div>Dashboard</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

function renderRoute() {
  return render(routeTree());
}
