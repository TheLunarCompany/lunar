import type { Meta, StoryObj } from "@storybook/react-vite";
import { ToolsDetails } from "./ToolsDetails";
import { withAppShell } from "@/stories/decorators";
import { createMockMcpServers } from "@/stories/mocks/data";

const meta = {
  title: "Dashboard/ToolsDetails",
  component: ToolsDetails,
  decorators: [withAppShell],
} satisfies Meta<typeof ToolsDetails>;

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

export const NoTools: Story = {
  args: {
    servers: [
      {
        id: "server-no-tools",
        name: "empty-server",
        args: [],
        command: "npx",
        status: "connected_running",
        type: "stdio",
        tools: [],
        usage: { callCount: 0 },
      },
    ],
  },
};
