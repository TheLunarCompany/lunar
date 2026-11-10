import type { Meta, StoryObj } from "@storybook/react-vite";
import { withAppShell } from "@/stories/decorators";
import Catalog from "./Catalog";

const meta = {
  title: "Pages/Catalog",
  component: Catalog,
  decorators: [withAppShell],
} satisfies Meta<typeof Catalog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
