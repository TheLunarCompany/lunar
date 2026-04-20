import type { Meta, StoryObj } from "@storybook/react-vite";
import { NodeBadge } from "./node-badge";

const meta: Meta<typeof NodeBadge> = {
  title: "Components/NodeCard/NodeBadge",
  component: NodeBadge,
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "warning", "info", "error"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { variant: "default", children: "Claude" },
};

export const Warning: Story = {
  args: { variant: "warning", children: "Pending user input" },
};

export const Info: Story = {
  args: { variant: "info", children: "Pending auth" },
};

export const Error: Story = {
  args: { variant: "error", children: "Connection error" },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <NodeBadge variant="default">Claude</NodeBadge>
      <NodeBadge variant="warning">Pending user input</NodeBadge>
      <NodeBadge variant="info">Pending auth</NodeBadge>
      <NodeBadge variant="error">Connection error</NodeBadge>
    </div>
  ),
};
