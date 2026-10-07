import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "@storybook/test";
import { withAppShell } from "@/stories/decorators";
import { AddServerModal } from "./AddServerModal";

const meta = {
  title: "Dashboard/Modals/AddServerModal",
  component: AddServerModal,
  decorators: [withAppShell],
  args: {
    onClose: fn(),
  },
} satisfies Meta<typeof AddServerModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
