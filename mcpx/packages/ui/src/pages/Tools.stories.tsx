import type { Meta, StoryObj } from "@storybook/react-vite";
import { withAppShell } from "@/stories/decorators";
import Tools from "./Tools";

const meta = {
  title: "Pages/Tools",
  component: Tools,
  decorators: [withAppShell],
} satisfies Meta<typeof Tools>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
