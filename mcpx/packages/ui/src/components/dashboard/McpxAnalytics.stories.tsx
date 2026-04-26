import type { Meta, StoryObj } from "@storybook/react-vite";
import { McpxAnalytics } from "./McpxAnalytics";

const meta = {
  title: "Dashboard/McpxAnalytics",
  component: McpxAnalytics,
} satisfies Meta<typeof McpxAnalytics>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    lastActivity: "2 minutes ago",
    totalRequests: 1234,
    totalAgents: 5,
  },
};

export const HighVolume: Story = {
  args: {
    lastActivity: "Just now",
    totalRequests: 1_500_000,
    totalAgents: 128,
  },
};

export const NoActivity: Story = {
  args: {
    lastActivity: "Never",
    totalRequests: 0,
    totalAgents: 0,
  },
};
