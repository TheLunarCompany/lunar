import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "@storybook/test";
import { withAppShell } from "@/stories/decorators";
import { ServerDetailsModal } from "./ServerDetailsModal";
const meta = {
  title: "Dashboard/Modals/ServerDetailsModal",
  component: ServerDetailsModal,
  decorators: [withAppShell],
  args: {
    isOpen: true,
    onClose: fn(),
    serverName: "my-mcp-server",
  },
} satisfies Meta<typeof ServerDetailsModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ConnectionFailed: Story = {
  args: {
    serverName: "broken-server",
  },
};

export const NoServer: Story = {
  args: {
    serverName: null,
  },
};
