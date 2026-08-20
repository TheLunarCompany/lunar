import type { Meta, StoryObj } from "@storybook/react-vite";
import { InstanceStatusScreen } from "./InstanceStatusScreen";
import type { PanelStatus } from "@/model/instance-status";

const meta = {
  title: "Instance Status/Screen",
  component: InstanceStatusScreen,
  parameters: {
    layout: "fullscreen",
  },
  argTypes: {
    status: {
      control: "select",
      options: ["initializing", "error", "offline"],
    },
  },
  render: (args) => (
    <div className="h-[520px] w-full">
      <InstanceStatusScreen {...args} />
    </div>
  ),
} satisfies Meta<typeof InstanceStatusScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Initializing: Story = {
  args: { status: "initializing" },
};

export const Error: Story = {
  args: { status: "error" },
};

export const Offline: Story = {
  args: { status: "offline" },
};

export const AllStates: Story = {
  args: { status: "initializing" },
  render: () => {
    const statuses: PanelStatus[] = ["initializing", "error", "offline"];

    return (
      <div className="grid min-h-screen grid-cols-2 gap-4 bg-instance-status-panel-background p-4">
        {statuses.map((status) => (
          <div key={status} className="h-[400px] rounded-xl">
            <InstanceStatusScreen status={status} />
          </div>
        ))}
      </div>
    );
  },
};
