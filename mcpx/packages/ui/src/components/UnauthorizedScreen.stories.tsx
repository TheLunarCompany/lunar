import type { Meta, StoryObj } from "@storybook/react-vite";
import { UnauthorizedScreen } from "./UnauthorizedScreen";

const meta = {
  title: "Components/UnauthorizedScreen",
  component: UnauthorizedScreen,
} satisfies Meta<typeof UnauthorizedScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const CustomMessage: Story = {
  args: {
    message: "Your account has been suspended. Please contact IT support.",
  },
};
