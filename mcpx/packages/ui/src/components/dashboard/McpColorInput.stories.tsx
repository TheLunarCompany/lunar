import type { Meta, StoryObj } from "@storybook/react-vite";
import { McpColorInput } from "./McpColorInput";
import { fn } from "@storybook/test";

const meta = {
  title: "Dashboard/McpColorInput",
  component: McpColorInput,
  args: {
    setIcon: fn(),
  },
} satisfies Meta<typeof McpColorInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    icon: "#4078c0",
  },
};

export const RedIcon: Story = {
  args: {
    icon: "#e34c26",
  },
};

export const GreenIcon: Story = {
  args: {
    icon: "#2ea44f",
  },
};
