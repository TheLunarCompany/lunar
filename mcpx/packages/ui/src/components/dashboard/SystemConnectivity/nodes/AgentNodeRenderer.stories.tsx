import type { Meta, StoryObj } from "@storybook/react-vite";
import AgentNodeRenderer from "./AgentNodeRenderer";
import { ReactFlow, ReactFlowProvider } from "@xyflow/react";
import { withSocketStore } from "@/stories/decorators";
import { createMockAgent } from "@/stories/mocks/data";
import type { Agent } from "@/types";
import "@xyflow/react/dist/style.css";

const nodeTypes = { agent: AgentNodeRenderer };

function makeAgentNode(id: string, agent: Agent) {
  return {
    id,
    type: "agent" as const,
    position: { x: 100, y: 100 },
    data: agent,
  };
}

const meta: Meta = {
  title: "Dashboard/Diagram/AgentNodeRenderer",
  decorators: [
    withSocketStore(),
    (Story) => (
      <ReactFlowProvider>
        <Story />
      </ReactFlowProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const agent = createMockAgent();
    const nodes = [makeAgentNode("1", agent)];
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

export const CursorAgent: Story = {
  render: () => {
    const agent = createMockAgent({ id: "a-cursor", identifier: "cursor" });
    const nodes = [makeAgentNode("1", agent)];
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

export const InactiveAgent: Story = {
  render: () => {
    const agent = createMockAgent({
      id: "a-inactive",
      identifier: "windsurf",
      usage: { callCount: 0, lastCalledAt: null },
    });
    const nodes = [makeAgentNode("1", agent)];
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

export const LongIdentifier: Story = {
  render: () => {
    const agent = createMockAgent({
      id: "a-long",
      identifier: "my-very-long-agent-identifier-name",
    });
    const nodes = [makeAgentNode("1", agent)];
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
