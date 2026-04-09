import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatusIcon } from "./StatusIcon";

const meta = {
  title: "Dashboard/StatusIcon",
  component: StatusIcon,
} satisfies Meta<typeof StatusIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Connected: Story = {
  args: {
    status: "connected",
  },
};

export const ConnectedRunning: Story = {
  args: {
    status: "connected_running",
  },
};

export const Connecting: Story = {
  args: {
    status: "connecting",
  },
};

export const Disconnected: Story = {
  args: {
    status: "disconnected",
  },
};

export const Error: Story = {
  args: {
    status: "error",
  },
};

export const PendingAuth: Story = {
  args: {
    status: "pending_auth",
  },
};

export const CustomSize: Story = {
  args: {
    status: "connected_running",
    size: "w-5 h-5",
  },
};

export const UnknownStatus: Story = {
  args: {
    status: "some_unknown_status",
  },
};
