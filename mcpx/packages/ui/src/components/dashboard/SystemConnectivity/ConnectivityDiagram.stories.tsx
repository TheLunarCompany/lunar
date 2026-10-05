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

const twentyMockAgents = Array.from({ length: 20 }, (_, index) =>
  createMockAgent({
    id: `agent-${index + 1}`,
    identifier: `mock-agent-${String(index + 1).padStart(2, "0")}`,
    sessionIds: [`session-${index + 1}`],
    usage: {
      callCount: (index + 1) * 7,
      lastCalledAt: new Date(),
    },
  }),
);

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

export const ActiveConnection: Story = {
  args: {
    agents: [
      createMockAgent({
        id: "agent-active-ai",
        identifier: "cursor",
        sessionIds: ["session-active-ai"],
        lastActivity: new Date(),
        usage: {
          callCount: 24,
          lastCalledAt: new Date(),
        },
      }),
    ],
    mcpServersData: [
      createMockMcpServer({
        id: "server-active",
        name: "github-mcp",
        status: "connected_running",
        icon: "#4078c0",
        usage: {
          callCount: 18,
          lastCalledAt: new Date(),
        },
      }),
    ],
    mcpxStatus: "running",
    version: "1.2.3",
  },
};

export const TwentyAgents: Story = {
  args: {
    agents: twentyMockAgents,
    mcpServersData: createMockMcpServers(),
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
