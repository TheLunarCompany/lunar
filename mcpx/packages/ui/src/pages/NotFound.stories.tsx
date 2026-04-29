import type { Meta, StoryObj } from "@storybook/react-vite";
import { withRouter } from "@/stories/decorators";
import NotFound from "./NotFound";

const meta = {
  title: "Pages/NotFound",
  component: NotFound,
  decorators: [withRouter],
} satisfies Meta<typeof NotFound>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
