import type { Meta, StoryObj } from "@storybook/react-vite";
import { AuthButtons } from "./AuthButtons";
import { withAuth, withSocketStore } from "@/stories/decorators";

const meta = {
  title: "Components/AuthButtons",
  component: AuthButtons,
  decorators: [withAuth(), withSocketStore()],
} satisfies Meta<typeof AuthButtons>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Authenticated: Story = {};

export const Loading: Story = {
  decorators: [withAuth({ loading: true }), withSocketStore()],
};

export const NotAuthenticated: Story = {
  decorators: [
    withAuth({
      isAuthenticated: false,
      user: null,
      loginRequired: true,
    }),
    withSocketStore(),
  ],
};

export const WithConnectionError: Story = {
  decorators: [withAuth(), withSocketStore({ connectError: true })],
};
