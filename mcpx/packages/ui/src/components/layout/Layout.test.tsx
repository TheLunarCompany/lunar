import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McpxProbeState } from "@/hooks/useMcpxProbe";
import { Layout } from "./Layout";

const harness = vi.hoisted(() => ({
  socket: {
    activeCallCount: 0,
    connectError: false,
    connectionRejectedHubRequired: false,
    isConnected: true,
    isPending: false,
    serializedAppConfig: "{}",
    systemState: { connectedClients: [] } as {
      connectedClients: [];
      configError?: string;
    },
  },
  useMcpxConnection: vi.fn(),
}));

vi.mock("@/data/identity", () => ({
  useIdentity: () => ({ data: undefined }),
  useIdentityLiveSync: () => {},
  getSpaceEditedByLabel: () => undefined,
  getSpaceKindLabel: () => "space",
  getSpaceName: () => undefined,
}));
vi.mock("@/components/dashboard/AddServerModal", () => ({
  AddServerModal: () => null,
}));
vi.mock("@/components/dashboard/ServerDetailsModal", () => ({
  ServerDetailsModal: () => null,
}));
vi.mock("@/components/dashboard/McpxConfigError", () => ({
  McpxConfigError: ({ message }: { message: string | null }) => (
    <div data-testid="config-error">{message || "Configuration Error"}</div>
  ),
}));
vi.mock("@/components/UserDetails", () => ({ UserDetails: () => null }));
vi.mock("@/contexts/useAuth", () => ({
  useAuth: () => ({ user: null, loginRequired: false, login: vi.fn() }),
}));
vi.mock("@/hooks/useMcpxConnection", () => ({
  useMcpxConnection: harness.useMcpxConnection,
}));
vi.mock("@/config/runtime-config", () => ({
  getRuntimeConfigSync: () => ({}),
  isMcpServersShown: () => true,
  isUiSidebarRestructureEnabled: () => true,
}));
vi.mock("@/store", () => ({
  useModalsStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      closeAddServerModal: vi.fn(),
      isAddServerModalOpen: false,
      closeConfigModal: vi.fn(),
      isConfigModalOpen: false,
      openConfigModal: vi.fn(),
      closeServerDetailsModal: vi.fn(),
      isServerDetailsModalOpen: false,
      selectedServerName: null,
    }),
  useSocketStore: (selector: (state: typeof harness.socket) => unknown) =>
    selector(harness.socket),
}));

describe("Layout", () => {
  beforeEach(() => {
    Object.assign(harness.socket, {
      activeCallCount: 0,
      connectError: false,
      connectionRejectedHubRequired: false,
      isConnected: true,
      isPending: false,
      serializedAppConfig: "{}",
      systemState: { connectedClients: [] },
    });
  });

  it.each([
    [{ type: "checking" }, "Initializing", "Preparing your MCPX workspace"],
    [{ type: "instance", status: "error" }, "Error", "MCPX needs attention"],
    [{ type: "gateway-unavailable" }, "Offline", "MCPX is offline"],
  ] as const)("renders probe state %s", (probeState, sidebar, panel) => {
    renderLayout(probeState);

    expect(screen.getByRole("status")).toHaveTextContent(sidebar);
    expect(screen.getByTestId("instance-status-screen")).toHaveTextContent(
      panel,
    );
    expect(screen.queryByText("Page content")).not.toBeInTheDocument();
  });

  it("shows initializing while a ready instance waits for the socket", () => {
    harness.socket.isConnected = false;
    harness.socket.isPending = false;

    renderLayout({ type: "ready" });

    expect(screen.getByRole("status")).toHaveTextContent("Initializing");
    expect(screen.getByTestId("instance-status-screen")).toHaveTextContent(
      "Preparing your MCPX workspace",
    );
    expect(screen.queryByText("MCPX is offline")).not.toBeInTheDocument();
  });

  it.each([
    [0, "Idle"],
    [2, "Working"],
  ] as const)("shows activity count %s as %s", (activeCallCount, status) => {
    harness.socket.activeCallCount = activeCallCount;

    renderLayout({ type: "ready" });

    expect(screen.getByRole("status")).toHaveTextContent(status);
    expect(screen.getByText("Page content")).toBeInTheDocument();
  });

  it("shows the admin-approval copy while a request is pending", () => {
    renderLayout({ type: "approval-pending" });

    expect(
      screen.getByText(/an administrator needs to approve your request/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("Page content")).not.toBeInTheDocument();
  });

  it("shows a higher-priority lifecycle state instead of a stale configuration error", () => {
    harness.socket.systemState = {
      connectedClients: [],
      configError: "Stale configuration error",
    };

    renderLayout({ type: "checking" });

    expect(screen.getByTestId("instance-status-screen")).toHaveTextContent(
      "Preparing your MCPX workspace",
    );
    expect(screen.queryByTestId("config-error")).not.toBeInTheDocument();
  });
});

function renderLayout(probeState: McpxProbeState) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(["skill-feature-enabled"], true);

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/dashboard"]}>
        <TooltipProvider>
          <Layout probeState={probeState}>
            <div>Page content</div>
          </Layout>
        </TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
