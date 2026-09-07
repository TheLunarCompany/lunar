import type { Meta, StoryObj } from "@storybook/react-vite";
import { AuthenticationDialog } from "./AuthenticationDialog";
import { fn } from "@storybook/test";

const meta = {
  title: "Dashboard/AuthenticationDialog",
  component: AuthenticationDialog,
  args: {
    onClose: fn(),
  },
} satisfies Meta<typeof AuthenticationDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    userCode: "ABCD-1234",
    serverStatus: "pending_auth",
  },
};

export const LongCode: Story = {
  args: {
    userCode: "WXYZ-5678-ABCD",
    serverStatus: "pending_auth",
  },
};

export const Closed: Story = {
  args: {
    userCode: null,
    serverStatus: "connection_failed",
  },
};
