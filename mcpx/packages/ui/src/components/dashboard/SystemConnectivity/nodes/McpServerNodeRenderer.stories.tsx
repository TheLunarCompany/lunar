import type { Meta, StoryObj } from "@storybook/react-vite";
import McpServerNodeRenderer from "./McpServerNodeRenderer";
import { ReactFlow, ReactFlowProvider } from "@xyflow/react";
import {
  withSocketStore,
  withToaster,
  withQueryClient,
} from "@/stories/decorators";
import { createMockMcpServer } from "@/stories/mocks/data";
import type { McpServer } from "@/types";
import "@xyflow/react/dist/style.css";

const nodeTypes = { mcpServer: McpServerNodeRenderer };

function makeServerNode(id: string, server: McpServer) {
  return {
    id,
    type: "mcpServer" as const,
    position: { x: 100, y: 100 },
    data: server,
  };
}

const meta: Meta = {
  title: "Dashboard/Diagram/McpServerNodeRenderer",
  decorators: [
    withSocketStore(),
    withToaster,
    withQueryClient,
    (Story) => (
      <ReactFlowProvider>
        <Story />
      </ReactFlowProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Connected: Story = {
  render: () => {
    const server = createMockMcpServer();
    const nodes = [makeServerNode("1", server)];
    return (
      <div style={{ width: "100%", height: 300 }}>
        <ReactFlow
          nodes={nodes}
          nodeTypes={nodeTypes}
          proOptions={{ hideAttribution: true }}
          fitView
        />
      </div>
    );
  },
};

export const Connecting: Story = {
  render: () => {
    const server = createMockMcpServer({
      id: "s-conn",
      name: "slack-mcp",
      status: "connecting",
      tools: [],
    });
    const nodes = [makeServerNode("1", server)];
    return (
      <div style={{ width: "100%", height: 300 }}>
        <ReactFlow
          nodes={nodes}
          nodeTypes={nodeTypes}
          proOptions={{ hideAttribution: true }}
          fitView
        />
      </div>
    );
  },
};

export const ConnectionFailed: Story = {
  render: () => {
    const server = createMockMcpServer({
      id: "s-fail",
      name: "broken-server",
      status: "connection_failed",
      tools: [],
      connectionError: "ECONNREFUSED 127.0.0.1:5000",
    });
    const nodes = [makeServerNode("1", server)];
    return (
      <div style={{ width: "100%", height: 300 }}>
        <ReactFlow
          nodes={nodes}
          nodeTypes={nodeTypes}
          proOptions={{ hideAttribution: true }}
          fitView
        />
      </div>
    );
  },
};

export const PendingAuth: Story = {
  render: () => {
    const server = createMockMcpServer({
      id: "s-auth",
      name: "auth-server",
      status: "pending_auth",
      tools: [],
    });
    const nodes = [makeServerNode("1", server)];
    return (
      <div style={{ width: "100%", height: 300 }}>
        <ReactFlow
          nodes={nodes}
          nodeTypes={nodeTypes}
          proOptions={{ hideAttribution: true }}
          fitView
        />
      </div>
    );
  },
};

export const PendingInput: Story = {
  render: () => {
    const server = createMockMcpServer({
      id: "s-input",
      name: "env-server",
      status: "pending_input",
      tools: [],
      missingEnvVars: [{ key: "API_KEY", type: "literal" }],
    });
    const nodes = [makeServerNode("1", server)];
    return (
      <div style={{ width: "100%", height: 300 }}>
        <ReactFlow
          nodes={nodes}
          nodeTypes={nodeTypes}
          proOptions={{ hideAttribution: true }}
          fitView
        />
      </div>
    );
  },
};

export const Inactive: Story = {
  render: () => {
    const server = createMockMcpServer({
      id: "s-inactive",
      name: "idle-server",
      status: "connected_inactive",
      tools: [
        {
          name: "tool_a",
          description: "A tool",
          invocations: 0,
          lastCalledAt: null,
        },
      ],
      usage: { callCount: 0 },
    });
    const nodes = [makeServerNode("1", server)];
    return (
      <div style={{ width: "100%", height: 300 }}>
        <ReactFlow
          nodes={nodes}
          nodeTypes={nodeTypes}
          proOptions={{ hideAttribution: true }}
          fitView
        />
      </div>
    );
  },
};
