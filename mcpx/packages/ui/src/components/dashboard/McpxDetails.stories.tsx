import type { Meta, StoryObj } from "@storybook/react-vite";
import { McpxDetails } from "./McpxDetails";
import { withAppShell } from "@/stories/decorators";
import { createMockAgents, createMockMcpServers } from "@/stories/mocks/data";

const meta = {
  title: "Dashboard/McpxDetails",
  component: McpxDetails,
  decorators: [withAppShell],
} satisfies Meta<typeof McpxDetails>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    agents: createMockAgents(),
    servers: createMockMcpServers(),
  },
};

export const Empty: Story = {
  args: {
    agents: [],
    servers: [],
  },
};

export const AgentsOnly: Story = {
  args: {
    agents: createMockAgents(),
    servers: [],
  },
};
