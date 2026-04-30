import type { Meta, StoryObj } from "@storybook/react-vite";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { fn } from "@storybook/test";

const meta = {
  title: "Dashboard/ConfirmDeleteDialog",
  component: ConfirmDeleteDialog,
  args: {
    onClose: fn(),
    onConfirm: fn(),
  },
} satisfies Meta<typeof ConfirmDeleteDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  args: {
    isOpen: true,
    title: "Are you sure you want to delete this server?",
    children: (
      <div className="p-4 text-sm text-gray-500">
        Background content that will be blurred.
      </div>
    ),
  },
};

export const Closed: Story = {
  args: {
    isOpen: false,
    title: "Are you sure you want to delete this server?",
    children: (
      <div className="p-4 text-sm text-gray-700">
        Normal content visible when dialog is closed.
      </div>
    ),
  },
};

export const CustomButtons: Story = {
  args: {
    isOpen: true,
    title: "Remove this tool from the space?",
    confirmButtonText: "Remove",
    cancelButtonText: "Keep",
    children: (
      <div className="p-4 text-sm text-gray-500">
        This action cannot be undone.
      </div>
    ),
  },
};
