import type { Meta, StoryObj } from "@storybook/react-vite";
import { ErrorBanner } from "./ErrorBanner";
import { fn } from "@storybook/test";

const meta = {
  title: "Components/ErrorBanner",
  component: ErrorBanner,
} satisfies Meta<typeof ErrorBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    message: "Something went wrong. Please try again later.",
  },
};

export const Dismissible: Story = {
  args: {
    message: "Failed to save changes. Your session may have expired.",
    onClose: fn(),
  },
};

export const LongMessage: Story = {
  args: {
    message:
      "An unexpected error occurred while processing your request. The server returned a 503 Service Unavailable response. Please check your network connection and try again. If the problem persists, contact support.",
    onClose: fn(),
  },
};
