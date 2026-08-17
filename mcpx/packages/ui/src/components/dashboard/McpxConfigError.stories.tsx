import type { Meta, StoryObj } from "@storybook/react-vite";
import { McpxConfigError } from "./McpxConfigError";

const meta = {
  title: "Dashboard/McpxConfigError",
  component: McpxConfigError,
} satisfies Meta<typeof McpxConfigError>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    message: null,
  },
};

export const CustomMessage: Story = {
  args: {
    message: "Missing required field: MCPX_API_KEY",
  },
};
