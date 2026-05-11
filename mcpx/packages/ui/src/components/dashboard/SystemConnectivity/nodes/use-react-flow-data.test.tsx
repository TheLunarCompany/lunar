import { act } from "@testing-library/react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useReactFlowData } from "./use-react-flow-data";
import { socketStore } from "@/store";
import { SERVER_STATUS } from "@/types/mcp-server";
import type { Agent, McpServer } from "@/types";
import type { Edge, Node } from "@xyflow/react";
import type { CoordinateExtent } from "@xyflow/system";

vi.mock("@xyflow/react", async () => {
  const React = await import("react");

  return {
    useEdgesState: <T,>(initial: T[]) => {
      const [state, setState] = React.useState(initial);
      return [state, setState, vi.fn()] as const;
    },
    useNodesState: <T,>(initial: T[]) => {
      const [state, setState] = React.useState(initial);
      return [state, setState, vi.fn()] as const;
    },
    useNodesInitialized: () => true,
    useReactFlow: () => ({
      getNodes: () => [],
    }),
  };
});

function createAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "agent-1",
    identifier: "cursor",
    sessionIds: ["session-1"],
    status: "connected",
    lastActivity: null,
    usage: {
      callCount: 0,
      lastCalledAt: null,
    },
    ...overrides,
  };
}

function createServer(overrides: Partial<McpServer> = {}): McpServer {
  return {
    id: "server-1",
    name: "notion",
    status: SERVER_STATUS.connected_stopped,
    tools: [],
    usage: {
      callCount: 0,
      lastCalledAt: null,
    },
    args: [],
    type: "stdio",
    ...overrides,
  };
}

describe("useReactFlowData", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    socketStore.setState({
      appConfig: null,
      systemState: null,
    });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  it("marks all active route nodes as selected", async () => {
    const now = Date.now();
    const agents = [
      createAgent({
        id: "agent-active",
        lastActivity: now,
      }),
      createAgent({
        id: "agent-idle",
        identifier: "claude",
        sessionIds: ["session-2"],
        lastActivity: now - 5 * 60 * 1000,
      }),
    ];
    const servers = [
      createServer({
        id: "server-running",
        name: "github",
        status: SERVER_STATUS.connected_running,
      }),
      createServer({
        id: "server-stopped",
        name: "linear",
        status: SERVER_STATUS.connected_stopped,
      }),
    ];

    type HookResult = {
      edges: Edge[];
      nodes: Node[];
      onNodesChange: ReturnType<typeof useReactFlowData>["onNodesChange"];
      onEdgesChange: ReturnType<typeof useReactFlowData>["onEdgesChange"];
      translateExtent?: CoordinateExtent;
    };

    const latestResult: { current: HookResult | null } = {
      current: null,
    };

    function TestHarness() {
      latestResult.current = useReactFlowData({
        agents,
        mcpServersData: servers,
        mcpxStatus: "running",
        version: "1.2.3",
      });
      return null;
    }

    await act(async () => {
      root.render(<TestHarness />);
    });

    expect(latestResult.current).not.toBeNull();

    if (!latestResult.current) {
      throw new Error("Expected hook result to be captured");
    }

    expect(latestResult.current.nodes.length).toBeGreaterThan(0);

    const selectedNodeIds = latestResult.current.nodes
      .filter((node) => node.selected)
      .map((node) => node.id);

    expect(selectedNodeIds).toEqual(
      expect.arrayContaining(["agent-active", "mcpx", "server-running"]),
    );
    expect(selectedNodeIds).not.toContain("agent-idle");
    expect(selectedNodeIds).not.toContain("server-stopped");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("builds routing metadata for agent edges so they share a junction", async () => {
    const agents = [
      createAgent({
        id: "agent-routed",
        identifier: "cursor",
        sessionIds: ["session-routed"],
      }),
    ];

    type HookResult = ReturnType<typeof useReactFlowData>;

    const latestResult: { current: HookResult | null } = {
      current: null,
    };

    function TestHarness() {
      latestResult.current = useReactFlowData({
        agents,
        mcpServersData: [],
        mcpxStatus: "running",
        version: "1.2.3",
      });
      return null;
    }

    await act(async () => {
      root.render(<TestHarness />);
    });

    expect(latestResult.current).not.toBeNull();

    if (!latestResult.current) {
      throw new Error("Expected hook result to be captured");
    }

    const agentEdge = latestResult.current.edges.find(
      (edge) => edge.id === "e-agent-routed",
    );

    expect(agentEdge).toMatchObject({
      source: "agent-routed",
      target: "mcpx",
      type: "curved",
      data: {
        animated: false,
        column: 0,
        nodesInColumn: 1,
        junctionX: -116,
        prevColumnLeftEdgeX: 0,
      },
    });

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("marks one agent edge and one server edge as add-button label hosts", async () => {
    const agents = [
      createAgent({
        id: "agent-routed",
        identifier: "cursor",
        sessionIds: ["session-routed"],
      }),
    ];
    const servers = [
      createServer({
        id: "server-routed",
        name: "github",
      }),
    ];

    type HookResult = ReturnType<typeof useReactFlowData>;

    const latestResult: { current: HookResult | null } = {
      current: null,
    };

    function TestHarness() {
      latestResult.current = useReactFlowData({
        agents,
        mcpServersData: servers,
        mcpxStatus: "running",
        version: "1.2.3",
      });
      return null;
    }

    await act(async () => {
      root.render(<TestHarness />);
    });

    expect(latestResult.current).not.toBeNull();

    if (!latestResult.current) {
      throw new Error("Expected hook result to be captured");
    }

    expect(latestResult.current.nodes.map((node) => node.type)).not.toContain(
      "addButton",
    );

    expect(
      latestResult.current.edges.filter(
        (edge) => edge.data?.addButtonKind === "agent",
      ),
    ).toHaveLength(1);
    expect(
      latestResult.current.edges.filter(
        (edge) => edge.data?.addButtonKind === "server",
      ),
    ).toHaveLength(1);
    expect(
      latestResult.current.edges.some(
        (edge) =>
          "onAddAgent" in (edge.data ?? {}) ||
          "onAddServer" in (edge.data ?? {}),
      ),
    ).toBe(false);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("uses the server-side MCPX gap for the agent side", async () => {
    const agents = [
      createAgent({
        id: "agent-gap",
        identifier: "cursor",
        sessionIds: ["session-gap"],
      }),
    ];
    const servers = [
      createServer({
        id: "server-gap",
        name: "github",
      }),
    ];

    type HookResult = ReturnType<typeof useReactFlowData>;

    const latestResult: { current: HookResult | null } = {
      current: null,
    };

    function TestHarness() {
      latestResult.current = useReactFlowData({
        agents,
        mcpServersData: servers,
        mcpxStatus: "running",
        version: "1.2.3",
      });
      return null;
    }

    await act(async () => {
      root.render(<TestHarness />);
    });

    expect(latestResult.current).not.toBeNull();

    if (!latestResult.current) {
      throw new Error("Expected hook result to be captured");
    }

    const mcpxNode = latestResult.current.nodes.find(
      (node) => node.id === "mcpx",
    );
    const agentNode = latestResult.current.nodes.find(
      (node) => node.id === "agent-gap",
    );
    const serverNode = latestResult.current.nodes.find(
      (node) => node.id === "server-gap",
    );

    expect(mcpxNode).toBeDefined();
    expect(agentNode).toBeDefined();
    expect(serverNode).toBeDefined();

    if (!mcpxNode || !agentNode || !serverNode) {
      throw new Error("Expected MCPX, agent, and server nodes");
    }

    const nodeWidth = 200;
    const agentGap = mcpxNode.position.x - (agentNode.position.x + nodeWidth);
    const serverGap = serverNode.position.x - (mcpxNode.position.x + nodeWidth);

    expect(agentGap).toBe(serverGap);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
