import type { Meta, StoryObj } from "@storybook/react-vite";
import { withAppShell } from "@/stories/decorators";
import { Layout } from "./Layout";

const meta = {
  title: "Layout/Layout",
  component: Layout,
  decorators: [withAppShell],
  args: {
    enableConnection: false,
    children: (
      <div className="p-8">
        <h1 className="text-2xl font-bold">Page Content</h1>
        <p className="mt-2 text-gray-600">
          This is sample content rendered inside the Layout component.
        </p>
      </div>
    ),
  },
} satisfies Meta<typeof Layout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
