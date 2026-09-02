import type { Meta, StoryObj } from "@storybook/react-vite";
import { MetricsPanel } from "./MetricsPanel";
import { withAppShell } from "@/stories/decorators";
import { createMockAgents, createMockMcpServers } from "@/stories/mocks/data";

const meta = {
  title: "Dashboard/MetricsPanel",
  component: MetricsPanel,
  decorators: [withAppShell],
} satisfies Meta<typeof MetricsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    agents: createMockAgents(),
    servers: createMockMcpServers(),
    systemUsage: {
      callCount: 200,
      lastCalledAt: new Date(),
    },
  },
};

export const Empty: Story = {
  args: {
    agents: [],
    servers: [],
  },
};

export const NoRecentActivity: Story = {
  args: {
    agents: createMockAgents(),
    servers: createMockMcpServers(),
    systemUsage: {
      callCount: 50,
    },
  },
};
