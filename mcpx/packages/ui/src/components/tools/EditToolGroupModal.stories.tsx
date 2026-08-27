import type { Meta, StoryObj } from "@storybook/react-vite";
import { EditToolGroupModal } from "./EditToolGroupModal";
import { fn } from "@storybook/test";

const meta = {
  title: "Tools/EditToolGroupModal",
  component: EditToolGroupModal,
  args: {
    isOpen: true,
    onClose: fn(),
    groupName: "File Operations",
    onGroupNameChange: fn(),
    groupDescription: "Tools for file read/write operations",
    onGroupDescriptionChange: fn(),
    onSave: fn(),
    isSaving: false,
  },
} satisfies Meta<typeof EditToolGroupModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithError: Story = {
  args: {
    groupName: "Bad @#$ Name",
    error:
      "Only letters, digits, spaces, dash (-) and underscore (_) are allowed",
  },
};

export const Saving: Story = {
  args: {
    isSaving: true,
  },
};
