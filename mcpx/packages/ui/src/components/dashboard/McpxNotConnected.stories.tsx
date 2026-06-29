import type { Meta, StoryObj } from "@storybook/react-vite";
import { McpxNotConnected } from "./McpxNotConnected";

const meta = {
  title: "Dashboard/McpxNotConnected",
  component: McpxNotConnected,
} satisfies Meta<typeof McpxNotConnected>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
