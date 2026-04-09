import type { Meta, StoryObj } from "@storybook/react-vite";
import { EditableBadge } from "./EditableBadge";
import { fn } from "@storybook/test";

const meta = {
  title: "Components/EditableBadge",
  component: EditableBadge,
  args: {
    onSave: fn(),
    onCancel: fn(),
  },
} satisfies Meta<typeof EditableBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: "My Space",
  },
};

export const WithLabel: Story = {
  args: {
    label: "Space Name",
    value: "Production",
  },
};

export const EmptyValue: Story = {
  args: {
    value: "",
  },
};

export const WithValidation: Story = {
  args: {
    value: "Edit me",
    validate: (v: string) =>
      v.trim().length < 3 ? "Must be at least 3 characters" : null,
  },
};

export const CustomBadgeStyle: Story = {
  args: {
    value: "Styled",
    badgeClassName: "bg-purple-50 text-purple-700 border-purple-200",
  },
};
