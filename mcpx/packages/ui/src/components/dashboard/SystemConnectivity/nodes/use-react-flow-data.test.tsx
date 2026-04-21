import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useReactFlowData } from "./use-react-flow-data";
import { socketStore } from "@/store";
import { SERVER_STATUS } from "@/types/mcp-server";
import type { Agent, McpServer } from "@/types";

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

    let latestResult: ReturnType<typeof useReactFlowData> | null = null;

    function TestHarness() {
      latestResult = useReactFlowData({
        agents,
        mcpServersData: servers,
        mcpxStatus: "running",
        version: "1.2.3",
      });
      return null;
    }

    await React.act(async () => {
      root.render(<TestHarness />);
    });

    expect(latestResult?.nodes.length).toBeGreaterThan(0);

    const selectedNodeIds = latestResult!.nodes
      .filter((node) => node.selected)
      .map((node) => node.id);

    expect(selectedNodeIds).toEqual(
      expect.arrayContaining(["agent-active", "mcpx", "server-running"]),
    );
    expect(selectedNodeIds).not.toContain("agent-idle");
    expect(selectedNodeIds).not.toContain("server-stopped");

    await React.act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
