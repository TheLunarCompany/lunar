import type { Meta, StoryObj } from "@storybook/react-vite";
import { McpServersDetails } from "./McpServersDetails";
import { withAppShell } from "@/stories/decorators";
import { createMockMcpServers } from "@/stories/mocks/data";

const meta = {
  title: "Dashboard/McpServersDetails",
  component: McpServersDetails,
  decorators: [withAppShell],
} satisfies Meta<typeof McpServersDetails>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    servers: createMockMcpServers(),
  },
};

export const Empty: Story = {
  args: {
    servers: [],
  },
};

export const SingleFailedServer: Story = {
  args: {
    servers: [
      {
        id: "server-fail",
        name: "broken-server",
        args: [],
        command: "npx",
        status: "connection_failed",
        type: "stdio",
        tools: [],
        usage: { callCount: 0 },
        connectionError: "Connection refused: ECONNREFUSED 127.0.0.1:5000",
      },
    ],
  },
};
