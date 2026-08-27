import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProvisioningScreen } from "./ProvisioningScreen";

const meta = {
  title: "Instance Status/Approval Pending",
  component: ProvisioningScreen,
  parameters: {
    layout: "fullscreen",
  },
  render: () => (
    <div className="h-[520px] w-full">
      <ProvisioningScreen />
    </div>
  ),
} satisfies Meta<typeof ProvisioningScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AwaitingAdminApproval: Story = {};
