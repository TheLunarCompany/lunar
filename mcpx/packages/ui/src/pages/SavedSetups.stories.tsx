import type { Meta, StoryObj } from "@storybook/react-vite";
import { withAppShell } from "@/stories/decorators";
import SavedSetups from "./SavedSetups";

const meta = {
  title: "Pages/SavedSetups",
  component: SavedSetups,
  decorators: [withAppShell],
} satisfies Meta<typeof SavedSetups>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
