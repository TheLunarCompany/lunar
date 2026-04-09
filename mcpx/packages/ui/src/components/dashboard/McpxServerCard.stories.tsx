import type { Meta, StoryObj } from "@storybook/react-vite";
import { McpxServerCard } from "./McpxServerCard";
import { withSocketStore } from "@/stories/decorators";
import { fn } from "@storybook/test";

const meta = {
  title: "Dashboard/McpxServerCard",
  component: McpxServerCard,
  decorators: [withSocketStore()],
  args: {
    onToggleChange: fn(),
  },
} satisfies Meta<typeof McpxServerCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    server: {
      name: "my-mcp-server",
      toolsCount: 5,
      icon: "#4078c0",
      status: "connected",
    },
  },
};

export const PendingAuth: Story = {
  args: {
    server: {
      name: "auth-server",
      toolsCount: 3,
      status: "pending-auth",
    },
  },
};

export const ConnectionFailed: Story = {
  args: {
    server: {
      name: "broken-server",
      toolsCount: 0,
      status: "connection-failed",
    },
  },
};
