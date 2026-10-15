import type { Meta, StoryObj } from "@storybook/react-vite";
import { ToolCard } from "./ToolCard";
import { fn } from "@storybook/test";

const baseTool = {
  name: "read_file",
  description:
    "Read a file from the filesystem given a relative or absolute path.",
  inputSchema: {
    type: "object" as const,
    properties: {
      path: { type: "string", description: "The file path to read" },
    },
    required: ["path"],
  },
};

const meta = {
  title: "Tools/ToolCard",
  component: ToolCard,
  args: {
    tool: baseTool,
    isEditMode: false,
    isAddCustomToolMode: false,
    isSelected: false,
    onToggleSelection: fn(),
    onToolClick: fn(),
    onCustomizeTool: fn(),
    onDeleteTool: fn(),
  },
} satisfies Meta<typeof ToolCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Selected: Story = {
  args: {
    isEditMode: true,
    isSelected: true,
  },
};

export const CustomTool: Story = {
  args: {
    tool: {
      ...baseTool,
      name: "custom_read_file",
      isCustom: true,
      originalToolName: "read_file",
      serviceName: "my-mcp-server",
    },
  },
};

export const Inactive: Story = {
  args: {
    isInactive: true,
    providerName: "disconnected-server",
  },
};

export const EditMode: Story = {
  args: {
    isEditMode: true,
    isSelected: false,
  },
};
