import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "@storybook/test";
import { withAppShell } from "@/stories/decorators";
import { McpxDetailsModal } from "./McpxDetailsModal";
import type { McpxData } from "./SystemConnectivity/types";

const mockMcpxData: McpxData = {
  status: "running",
  version: "1.2.3",
  servers: [
    {
      name: "my-mcp-server",
      status: "connected_running",
      tools: 2,
      invocations: 57,
    },
    {
      name: "github-mcp",
      status: "connected_running",
      tools: 1,
      invocations: 10,
    },
  ],
  agents: 3,
  usage: { callCount: 200, lastCalledAt: new Date() },
} as unknown as McpxData;

const meta = {
  title: "Dashboard/Modals/McpxDetailsModal",
  component: McpxDetailsModal,
  decorators: [withAppShell],
  args: {
    mcpxData: mockMcpxData,
    isOpen: true,
    onClose: fn(),
  },
} satisfies Meta<typeof McpxDetailsModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Closed: Story = {
  args: {
    isOpen: false,
  },
};
