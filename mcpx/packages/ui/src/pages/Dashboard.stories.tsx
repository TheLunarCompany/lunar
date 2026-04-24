import type { Meta, StoryObj } from "@storybook/react-vite";
import { withAppShell } from "@/stories/decorators";
import Dashboard from "./Dashboard";

const meta = {
  title: "Pages/Dashboard",
  component: Dashboard,
  decorators: [withAppShell],
} satisfies Meta<typeof Dashboard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
