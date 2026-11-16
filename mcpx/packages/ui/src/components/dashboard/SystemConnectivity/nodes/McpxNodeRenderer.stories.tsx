import type { Meta, StoryObj } from "@storybook/react-vite";
import McpxNodeRenderer from "./McpxNodeRenderer";
import { ReactFlow, ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const nodeTypes = { mcpx: McpxNodeRenderer };

const meta: Meta = {
  title: "Dashboard/Diagram/McpxNodeRenderer",
  decorators: [
    (Story) => (
      <ReactFlowProvider>
        <Story />
      </ReactFlowProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Running: Story = {
  render: () => {
    const nodes = [
      {
        id: "1",
        type: "mcpx" as const,
        position: { x: 100, y: 100 },
        data: { status: "running", version: "1.2.3" },
      },
    ];
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

export const Stopped: Story = {
  render: () => {
    const nodes = [
      {
        id: "1",
        type: "mcpx" as const,
        position: { x: 100, y: 100 },
        data: { status: "stopped", version: "1.2.3" },
      },
    ];
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

export const UnknownVersion: Story = {
  render: () => {
    const nodes = [
      {
        id: "1",
        type: "mcpx" as const,
        position: { x: 100, y: 100 },
        data: { status: "running" },
      },
    ];
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

export const PreReleaseVersion: Story = {
  render: () => {
    const nodes = [
      {
        id: "1",
        type: "mcpx" as const,
        position: { x: 100, y: 100 },
        data: { status: "running", version: "2.0.0-beta.1" },
      },
    ];
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
