import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "@storybook/test";
import { withAppShell } from "@/stories/decorators";
import { ServerDetailsModal } from "./ServerDetailsModal";
import { createMockMcpServer } from "@/stories/mocks/data";

const mockServer = createMockMcpServer();

const meta = {
  title: "Dashboard/Modals/ServerDetailsModal",
  component: ServerDetailsModal,
  decorators: [withAppShell],
  args: {
    isOpen: true,
    onClose: fn(),
    server: mockServer,
  },
} satisfies Meta<typeof ServerDetailsModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ConnectionFailed: Story = {
  args: {
    server: createMockMcpServer({
      id: "server-broken",
      name: "broken-server",
      status: "connection_failed",
      connectionError: "Connection refused: ECONNREFUSED 127.0.0.1:5000",
      tools: [],
    }),
  },
};

export const NoServer: Story = {
  args: {
    server: null,
  },
};
