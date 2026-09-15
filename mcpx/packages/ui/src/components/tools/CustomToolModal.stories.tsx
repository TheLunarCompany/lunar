import type { Meta, StoryObj } from "@storybook/react-vite";
import { CustomToolModal } from "./CustomToolModal";
import { fn } from "@storybook/test";
import { createMockCustomTool } from "@/stories/mocks/data";
import { withToaster } from "@/stories/decorators";

const meta = {
  title: "Tools/CustomToolModal",
  component: CustomToolModal,
  decorators: [withToaster],
  args: {
    handleSubmitTool: fn(),
    onClose: fn(),
    validateUniqueToolName: () => true,
  },
} satisfies Meta<typeof CustomToolModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NewTool: Story = {
  args: {
    tool: createMockCustomTool({ name: "" }),
  },
};

export const EditExisting: Story = {
  args: {
    tool: createMockCustomTool(),
  },
};

export const WithBooleanParam: Story = {
  args: {
    tool: createMockCustomTool({
      originalTool: {
        id: "server/tool",
        name: "toggle_feature",
        description: "Toggle a feature flag",
        serviceName: "my-mcp-server",
        inputSchema: {
          type: "object" as const,
          properties: {
            featureName: { type: "string", description: "Feature name" },
            enabled: { type: "boolean", description: "Enable or disable" },
          },
          required: ["featureName"],
        },
      },
      overrideParams: {},
    }),
  },
};
