import type { Meta, StoryObj } from "@storybook/react-vite";
import { AgentsDetails } from "./AgentsDetails";
import { withAppShell } from "@/stories/decorators";
import { createMockAgents } from "@/stories/mocks/data";

const meta = {
  title: "Dashboard/AgentsDetails",
  component: AgentsDetails,
  decorators: [withAppShell],
} satisfies Meta<typeof AgentsDetails>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    agents: createMockAgents(),
  },
};

export const Empty: Story = {
  args: {
    agents: [],
  },
};

export const SingleAgent: Story = {
  args: {
    agents: [
      {
        id: "agent-1",
        identifier: "claude-desktop",
        sessionIds: ["session-abc-123"],
        status: "connected",
        lastActivity: new Date(),
        llm: { provider: "anthropic", model: "claude-sonnet-4-20250514" },
        usage: { callCount: 120, lastCalledAt: new Date() },
      },
    ],
  },
};
