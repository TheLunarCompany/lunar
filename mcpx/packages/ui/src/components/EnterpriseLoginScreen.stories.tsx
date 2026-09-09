import type { Meta, StoryObj } from "@storybook/react-vite";
import EnterpriseLoginScreen from "./EnterpriseLoginScreen";
import { withAuth } from "@/stories/decorators";

const meta = {
  title: "Components/EnterpriseLoginScreen",
  component: EnterpriseLoginScreen,
  decorators: [withAuth({ isAuthenticated: false, user: null })],
} satisfies Meta<typeof EnterpriseLoginScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = {
  decorators: [withAuth({ isAuthenticated: false, user: null, loading: true })],
};

export const WithError: Story = {
  decorators: [
    withAuth({
      isAuthenticated: false,
      user: null,
      error: "Unable to connect to authentication server. Please try again.",
    }),
  ],
};
