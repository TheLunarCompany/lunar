import type { Meta, StoryObj } from "@storybook/react-vite";
import { DashboardScrollArea } from "./DashboardScrollArea";
import { withAppShell } from "@/stories/decorators";

const meta = {
  title: "Dashboard/DashboardScrollArea",
  component: DashboardScrollArea,
  decorators: [withAppShell],
} satisfies Meta<typeof DashboardScrollArea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <div className="space-y-4 p-4">
        {Array.from({ length: 20 }, (_, i) => (
          <div key={i} className="rounded-md border p-4 bg-white">
            Item {i + 1}
          </div>
        ))}
      </div>
    ),
  },
};

export const ShortContent: Story = {
  args: {
    children: (
      <div className="p-4">
        <p>Short content that does not require scrolling.</p>
      </div>
    ),
  },
};
