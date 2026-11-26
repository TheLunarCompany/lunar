import type { Meta, StoryObj } from "@storybook/react-vite";
import { InstanceStatusRow } from "./InstanceStatusRow";
import type { InstanceStatus } from "@/model/instance-status";

const statuses: InstanceStatus[] = [
  "initializing",
  "idle",
  "working",
  "error",
  "offline",
];

const meta = {
  title: "Instance Status/Row",
  component: InstanceStatusRow,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    status: {
      control: "select",
      options: statuses,
    },
  },
  render: (args) => (
    <div className="w-72 rounded-xl bg-primary p-4">
      <InstanceStatusRow {...args} />
    </div>
  ),
} satisfies Meta<typeof InstanceStatusRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    status: "idle",
  },
};

export const AllStates: Story = {
  args: {
    status: "idle",
  },
  render: () => (
    <div className="w-72 space-y-2 rounded-xl bg-primary p-3">
      {statuses.map((status) => (
        <InstanceStatusRow key={status} status={status} />
      ))}
    </div>
  ),
};
