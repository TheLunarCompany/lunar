import type { Meta, StoryObj } from "@storybook/react-vite";
import { withAppShell } from "@/stories/decorators";
import AccessControls from "./AccessControls";

const meta = {
  title: "Pages/AccessControls",
  component: AccessControls,
  decorators: [withAppShell],
} satisfies Meta<typeof AccessControls>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
