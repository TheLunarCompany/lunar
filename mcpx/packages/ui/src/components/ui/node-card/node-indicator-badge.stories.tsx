import type { Meta, StoryObj } from "@storybook/react-vite";
import { NodeIndicatorBadge } from "./node-indicator-badge";

const meta: Meta<typeof NodeIndicatorBadge> = {
  title: "Components/NodeCard/NodeIndicatorBadge",
  component: NodeIndicatorBadge,
  argTypes: {
    variant: {
      control: "select",
      options: ["warning", "info", "error"],
    },
  },
  decorators: [
    (Story) => (
      <div className="relative size-20">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Warning: Story = {
  args: { variant: "warning" },
};

export const Info: Story = {
  args: { variant: "info" },
};

export const Error: Story = {
  args: { variant: "error" },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex gap-6">
      {(["warning", "info", "error"] as const).map((variant) => (
        <div
          key={variant}
          className="relative size-16 rounded-lg border border-dashed border-gray-300"
        >
          <NodeIndicatorBadge variant={variant} />
        </div>
      ))}
    </div>
  ),
};
