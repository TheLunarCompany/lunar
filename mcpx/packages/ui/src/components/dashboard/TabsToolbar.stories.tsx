import type { Meta, StoryObj } from "@storybook/react-vite";
import { TabsToolbar } from "./TabsToolbar";
import { withAppShell } from "@/stories/decorators";
import { Tabs } from "@/components/ui/tabs";

const meta = {
  title: "Dashboard/TabsToolbar",
  component: TabsToolbar,
  decorators: [
    withAppShell,
    (Story) => (
      <Tabs defaultValue="mcpx">
        <Story />
      </Tabs>
    ),
  ],
} satisfies Meta<typeof TabsToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
