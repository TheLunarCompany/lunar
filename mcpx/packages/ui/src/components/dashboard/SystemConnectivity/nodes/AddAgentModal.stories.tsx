import type { Meta, StoryObj } from "@storybook/react-vite";
import { AddAgentModal } from "./AddAgentModal";
import { withSocketStore } from "@/stories/decorators";

const meta = {
  title: "Dashboard/Diagram/AddAgentModal",
  component: AddAgentModal,
  decorators: [withSocketStore()],
} satisfies Meta<typeof AddAgentModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
  },
};

export const Closed: Story = {
  args: {
    isOpen: false,
    onClose: () => {},
  },
};
