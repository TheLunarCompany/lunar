import type { Meta, StoryObj } from "@storybook/react-vite";
import CustomBadge from "./CustomBadge";
import { Star } from "lucide-react";

const meta = {
  title: "Components/CustomBadge",
  component: CustomBadge,
} satisfies Meta<typeof CustomBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: "Badge Label",
  },
};

export const WithIcon: Story = {
  args: {
    label: "Starred",
    icon: <Star className="w-3 h-3" />,
  },
};

export const SmallSize: Story = {
  args: {
    label: "Small",
    size: "sm",
  },
};

export const MediumFullRounded: Story = {
  args: {
    label: "Medium Full",
    size: "md",
    rounded: "full",
  },
};
