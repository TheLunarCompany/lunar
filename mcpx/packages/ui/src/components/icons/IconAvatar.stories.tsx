import type { Meta, StoryObj } from "@storybook/react-vite";
import { IconAvatar } from "./IconAvatar";

const meta = {
  title: "Icons/IconAvatar",
  component: IconAvatar,
  args: {
    size: 40,
    seed: "test-seed",
  },
} satisfies Meta<typeof IconAvatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Small: Story = {
  args: {
    size: 20,
    seed: "small",
  },
};

export const Large: Story = {
  args: {
    size: 80,
    seed: "large",
  },
};

export const DifferentSeeds: Story = {
  render: () => (
    <div className="flex gap-4 flex-wrap">
      {["alpha", "beta", "gamma", "delta", "epsilon", "zeta"].map((seed) => (
        <div key={seed} className="flex flex-col items-center gap-1">
          <IconAvatar size={40} seed={seed} />
          <span className="text-xs text-gray-500">{seed}</span>
        </div>
      ))}
    </div>
  ),
};

export const NumericSeeds: Story = {
  render: () => (
    <div className="flex gap-4 flex-wrap">
      {[0, 1, 2, 3, 4, 5, 10, 20, 50].map((seed) => (
        <div key={seed} className="flex flex-col items-center gap-1">
          <IconAvatar size={40} seed={seed} />
          <span className="text-xs text-gray-500">{seed}</span>
        </div>
      ))}
    </div>
  ),
};
