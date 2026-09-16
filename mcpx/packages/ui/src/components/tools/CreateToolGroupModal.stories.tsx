import type { Meta, StoryObj } from "@storybook/react-vite";
import { CreateToolGroupModal } from "./CreateToolGroupModal";
import { fn } from "@storybook/test";

const meta = {
  title: "Tools/CreateToolGroupModal",
  component: CreateToolGroupModal,
  args: {
    isOpen: true,
    onClose: fn(),
    newGroupName: "",
    onGroupNameChange: fn(),
    newGroupDescription: "",
    onGroupDescriptionChange: fn(),
    onSave: fn(),
    isCreating: false,
    selectedToolsCount: 3,
  },
} satisfies Meta<typeof CreateToolGroupModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithName: Story = {
  args: {
    newGroupName: "File Operations",
    newGroupDescription: "Tools for reading and writing files",
  },
};

export const WithError: Story = {
  args: {
    newGroupName: "Invalid Group Name!!!",
    error:
      "Only letters, digits, spaces, dash (-) and underscore (_) are allowed",
  },
};

export const Creating: Story = {
  args: {
    newGroupName: "File Operations",
    isCreating: true,
  },
};
