import type { Meta, StoryObj } from "@storybook/react-vite";
import { MiniMap } from "./MiniMap";
import { ReactFlow, ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const sampleNodes = [
  {
    id: "1",
    type: "mcpx",
    position: { x: 300, y: 200 },
    data: { status: "running", version: "1.2.3" },
  },
  {
    id: "2",
    type: "agent",
    position: { x: 50, y: 200 },
    data: { label: "Agent" },
  },
  {
    id: "3",
    type: "mcpServer",
    position: { x: 550, y: 150 },
    data: { label: "Server" },
  },
  {
    id: "4",
    type: "mcpServer",
    position: { x: 550, y: 300 },
    data: { label: "Server 2" },
  },
];

const meta = {
  title: "Dashboard/Diagram/MiniMap",
  component: MiniMap,
  decorators: [
    (Story) => (
      <ReactFlowProvider>
        <div style={{ width: "100%", height: 400 }}>
          <ReactFlow
            nodes={sampleNodes}
            proOptions={{ hideAttribution: true }}
            fitView
          >
            <Story />
          </ReactFlow>
        </div>
      </ReactFlowProvider>
    ),
  ],
} satisfies Meta<typeof MiniMap>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
