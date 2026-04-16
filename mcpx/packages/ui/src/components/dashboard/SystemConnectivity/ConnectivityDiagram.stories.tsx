import type { Meta, StoryObj } from "@storybook/react-vite";
import { ConnectivityDiagram } from "./ConnectivityDiagram";
import { withAppShell } from "@/stories/decorators";
import {
  createMockAgents,
  createMockMcpServers,
  createMockAgent,
  createMockMcpServer,
} from "@/stories/mocks/data";

const meta = {
  title: "Dashboard/Diagram/ConnectivityDiagram",
  component: ConnectivityDiagram,
  decorators: [withAppShell],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ConnectivityDiagram>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    agents: createMockAgents(),
    mcpServersData: createMockMcpServers(),
    mcpxStatus: "running",
    version: "1.2.3",
  },
};

export const SingleAgentSingleServer: Story = {
  args: {
    agents: [createMockAgent()],
    mcpServersData: [createMockMcpServer()],
    mcpxStatus: "running",
    version: "1.2.3",
  },
};

export const NoAgentsNoServers: Story = {
  args: {
    agents: [],
    mcpServersData: [],
    mcpxStatus: "running",
    version: "1.2.3",
  },
};

export const McpxStopped: Story = {
  args: {
    agents: createMockAgents(),
    mcpServersData: createMockMcpServers(),
    mcpxStatus: "stopped",
    version: "1.2.3",
  },
};

export const WithInitialAddServerModal: Story = {
  args: {
    agents: createMockAgents(),
    mcpServersData: createMockMcpServers(),
    mcpxStatus: "running",
    version: "1.2.3",
    initialOpenAddServerModal: true,
  },
};
