import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "@storybook/test";
import { withAppShell } from "@/stories/decorators";
import { EditServerModal } from "./EditServerModal";

const meta = {
  title: "Dashboard/Modals/EditServerModal",
  component: EditServerModal,
  decorators: [withAppShell],
  args: {
    isOpen: true,
    onClose: fn(),
  },
} satisfies Meta<typeof EditServerModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
