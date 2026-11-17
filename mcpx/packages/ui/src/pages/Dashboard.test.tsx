import { render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useIsEditingSpaceOnBehalf } from "@/data/identity";
import Dashboard from "./Dashboard";

vi.mock("@/data/identity", () => ({
  useIsEditingSpaceOnBehalf: vi.fn(),
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
      isEditingSpaceOnBehalf,
    }: ComponentProps<
      typeof import("@/components/dashboard/SystemConnectivity/ConnectivityDiagram").ConnectivityDiagram
    >) => (
      <div
        data-hosted-mode={String(isEditingSpaceOnBehalf)}
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
    vi.mocked(useIsEditingSpaceOnBehalf).mockReset();
    vi.mocked(useIsEditingSpaceOnBehalf).mockReturnValue(false);
  });

  it("passes hosted mode to the connectivity diagram when the space is under OBO edit", () => {
    vi.mocked(useIsEditingSpaceOnBehalf).mockReturnValue(true);

    renderDashboard();

    expect(screen.getByTestId("connectivity-diagram")).toHaveAttribute(
      "data-hosted-mode",
      "true",
    );
  });

  it("passes non-hosted mode when the space is not under OBO edit", () => {
    renderDashboard();

    expect(screen.getByTestId("connectivity-diagram")).toHaveAttribute(
      "data-hosted-mode",
      "false",
    );
  });
});
