import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConnectivityDiagram } from "./ConnectivityDiagram";

const useReactFlowDataCalls: unknown[] = [];

vi.mock("@xyflow/react", () => ({
  Controls: () => <div data-testid="controls" />,
  Panel: ({ children }: { children: ReactNode }) => (
    <div data-testid="panel">{children}</div>
  ),
  ReactFlow: ({ children }: { children: ReactNode }) => (
    <div data-testid="react-flow">{children}</div>
  ),
  useReactFlow: () => ({ fitView: vi.fn() }),
}));

vi.mock("./MiniMap", () => ({
  MiniMap: () => <div data-testid="mini-map" />,
}));

vi.mock("./nodes", () => ({
  edgeTypes: {},
  nodeTypes: {},
}));

vi.mock("./nodes/add-button-actions", () => ({
  AddButtonActionsProvider: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("./nodes/use-react-flow-data", () => ({
  useReactFlowData: (args: unknown) => {
    useReactFlowDataCalls.push(args);
    return {
      edges: [],
      nodes: [{ id: "mcpx", position: { x: 0, y: 0 } }],
      onEdgesChange: vi.fn(),
      onNodesChange: vi.fn(),
      translateExtent: undefined,
    };
  },
}));

vi.mock("../AddServerModal", () => ({
  AddServerModal: () => <div data-testid="add-server-modal" />,
}));

vi.mock("./nodes/AddAgentModal", () => ({
  AddAgentModal: () => <div data-testid="add-agent-modal" />,
}));

vi.mock("../AgentDetailsModal", () => ({
  AgentDetailsModal: () => <div data-testid="agent-details-modal" />,
}));

vi.mock("../McpxDetailsModal", () => ({
  McpxDetailsModal: () => <div data-testid="mcpx-details-modal" />,
}));

vi.mock("./nodes/ServerContextMenu", () => ({
  ServerContextMenu: () => <div data-testid="server-context-menu" />,
}));

vi.mock("@/data/mcp-server", () => ({
  useDeleteMcpServer: () => ({ mutate: vi.fn() }),
}));

vi.mock("@/data/permissions", () => ({
  usePermissions: () => ({ canAddCustomServerAndEdit: true }),
}));

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ dismiss: vi.fn(), toast: vi.fn() }),
}));

const dashboardState = {
  setCurrentTab: vi.fn(),
  setOptimisticallyRemovedServerName: vi.fn(),
};

const modalsState = {
  closeAgentDetailsModal: vi.fn(),
  closeMcpxDetailsModal: vi.fn(),
  isAgentDetailsModalOpen: false,
  isMcpxDetailsModalOpen: false,
  openAgentDetailsModal: vi.fn(),
  openEditServerModal: vi.fn(),
  openMcpxDetailsModal: vi.fn(),
  openServerDetailsModal: vi.fn(),
  selectedAgent: null,
  selectedMcpxData: null,
};

const socketState = {
  appConfig: null,
  emitPatchAppConfig: vi.fn(),
};

vi.mock("@/store", () => ({
  useDashboardStore: (selector: (state: typeof dashboardState) => unknown) =>
    selector(dashboardState),
  useModalsStore: (selector: (state: typeof modalsState) => unknown) =>
    selector(modalsState),
  useSocketStore: (selector: (state: typeof socketState) => unknown) =>
    selector(socketState),
}));

function renderDiagram(isEditingSpaceOnBehalf: boolean) {
  return render(
    <MemoryRouter>
      <ConnectivityDiagram
        agents={[]}
        isEditingSpaceOnBehalf={isEditingSpaceOnBehalf}
        mcpServersData={[]}
        mcpxStatus="running"
        version="1.2.3"
      />
    </MemoryRouter>,
  );
}

describe("ConnectivityDiagram", () => {
  beforeEach(() => {
    useReactFlowDataCalls.length = 0;
  });

  it("hides Add Agent and keeps Add Server in hosted mode", () => {
    renderDiagram(true);

    expect(screen.queryByText("Hosted Mode")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /add agent/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add server/i }),
    ).toBeInTheDocument();
    expect(useReactFlowDataCalls.at(-1)).toMatchObject({
      isEditingSpaceOnBehalf: true,
    });
  });

  it("shows both add controls outside hosted mode", () => {
    renderDiagram(false);

    expect(screen.queryByText("Editing hosted setup")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add agent/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add server/i }),
    ).toBeInTheDocument();
    expect(useReactFlowDataCalls.at(-1)).toMatchObject({
      isEditingSpaceOnBehalf: false,
    });
  });
});
