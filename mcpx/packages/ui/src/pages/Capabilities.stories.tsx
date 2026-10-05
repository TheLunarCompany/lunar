import type { Meta, StoryObj } from "@storybook/react-vite";
import { withAppShell } from "@/stories/decorators";
import Capabilities from "./Capabilities";

const meta = {
  title: "Pages/Capabilities",
  component: Capabilities,
  decorators: [withAppShell],
} satisfies Meta<typeof Capabilities>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
