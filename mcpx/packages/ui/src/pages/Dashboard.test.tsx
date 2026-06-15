import { render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getHostedMcpEditContextFromLocation } from "@/data/hosted-mcp-edit-context";
import Dashboard from "./Dashboard";

vi.mock("@/data/hosted-mcp-edit-context", () => ({
  getHostedMcpEditContextFromLocation: vi.fn(),
}));

vi.mock("@/components/dashboard/MetricsPanel", () => ({
  MetricsPanel: () => <div data-testid="metrics-panel" />,
}));

vi.mock("@/components/dashboard/EditServerModal", () => ({
  EditServerModal: () => <div data-testid="edit-server-modal" />,
}));

vi.mock(
  "@/components/dashboard/SystemConnectivity/ConnectivityDiagram",
  () => ({
    ConnectivityDiagram: ({
      hostedMode,
    }: ComponentProps<
      typeof import("@/components/dashboard/SystemConnectivity/ConnectivityDiagram").ConnectivityDiagram
    >) => (
      <div
        data-hosted-mode={String(hostedMode)}
        data-testid="connectivity-diagram"
      />
    ),
  }),
);

vi.mock("@/components/ui/card", () => ({
  Card: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  CardContent: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
}));

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ dismiss: vi.fn() }),
}));

const dashboardState = {
  isDiagramExpanded: true,
  optimisticallyRemovedServerName: null,
  reset: vi.fn(),
  setOptimisticallyRemovedServerName: vi.fn(),
  toggleDiagramExpansion: vi.fn(),
};

const modalsState = {
  closeEditServerModal: vi.fn(),
  isEditServerModalOpen: false,
};

const socketState = {
  systemState: null,
};

vi.mock("@/store", () => ({
  useDashboardStore: (selector: (state: typeof dashboardState) => unknown) =>
    selector(dashboardState),
  useModalsStore: (selector: (state: typeof modalsState) => unknown) =>
    selector(modalsState),
  useSocketStore: (selector: (state: typeof socketState) => unknown) =>
    selector(socketState),
}));

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );
}

describe("Dashboard", () => {
  beforeEach(() => {
    vi.mocked(getHostedMcpEditContextFromLocation).mockReset();
    vi.mocked(getHostedMcpEditContextFromLocation).mockReturnValue(null);
  });

  it("passes hosted mode to the connectivity diagram when the URL has hosted edit context", () => {
    vi.mocked(getHostedMcpEditContextFromLocation).mockReturnValue({
      returnUrl: "https://mcpx-admin-stg.lunar.dev/hosted-mcp-server",
      spaceId: "space-123",
    });

    renderDashboard();

    expect(screen.getByTestId("connectivity-diagram")).toHaveAttribute(
      "data-hosted-mode",
      "true",
    );
    expect(screen.getByText("Hosted Mode")).toBeInTheDocument();
    expect(
      screen.getByText("You're editing the MCP server setup."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /finish in mcpx admin/i }),
    ).toHaveAttribute(
      "href",
      "https://mcpx-admin-stg.lunar.dev/hosted-mcp-server",
    );
  });

  it("passes non-hosted mode when hosted edit context is absent", () => {
    renderDashboard();

    expect(screen.getByTestId("connectivity-diagram")).toHaveAttribute(
      "data-hosted-mode",
      "false",
    );
    expect(screen.queryByText("Hosted Mode")).not.toBeInTheDocument();
  });
});
