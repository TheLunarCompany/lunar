import type { Meta, StoryObj } from "@storybook/react-vite";
import { ToolDetailsModal } from "./ToolDetailsModal";
import { fn } from "@storybook/test";
import { createMockToolDetails } from "@/stories/mocks/data";

const meta = {
  title: "Tools/ToolDetailsModal",
  component: ToolDetailsModal,
  args: {
    onClose: fn(),
    onCustomize: fn(),
    tool: createMockToolDetails(),
  },
} satisfies Meta<typeof ToolDetailsModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithOverrideParams: Story = {
  args: {
    tool: createMockToolDetails({
      name: "custom_read_file",
      originalToolName: "read_file",
      overrideParams: {
        path: {
          value: "/src",
          description: { action: "rewrite", text: "Base directory" },
        },
      },
    }),
  },
};

export const NoParams: Story = {
  args: {
    tool: createMockToolDetails({
      name: "simple_tool",
      description: "A tool without parameters",
      params: [],
    }),
  },
};
