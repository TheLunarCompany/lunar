import type { Meta, StoryObj } from "@storybook/react-vite";
import { ToolDetailsDialog } from "./ToolDetailsDialog";
import { fn } from "@storybook/test";

const baseTool = {
  name: "read_file",
  description:
    "Read a file from the filesystem given a relative or absolute path. Returns the file contents as a string.",
  inputSchema: {
    type: "object" as const,
    properties: {
      path: { type: "string", description: "The file path to read" },
      encoding: {
        type: "string",
        description: "File encoding (default utf-8)",
      },
    },
    required: ["path"],
  },
  serviceName: "my-mcp-server",
};

const meta = {
  title: "Tools/ToolDetailsDialog",
  component: ToolDetailsDialog,
  args: {
    isOpen: true,
    onClose: fn(),
    tool: baseTool,
    onEdit: fn(),
    onDuplicate: fn(),
    onDelete: fn(),
    onCustomize: fn(),
  },
} satisfies Meta<typeof ToolDetailsDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ServerTool: Story = {};

export const CustomToolDetails: Story = {
  args: {
    tool: {
      ...baseTool,
      name: "custom_read_file",
      isCustom: true,
      originalToolName: "read_file",
      overrideParams: {
        path: { value: "/src" },
        encoding: { value: "utf-8", description: { text: "Always use UTF-8" } },
      },
    },
  },
};

export const NoParameters: Story = {
  args: {
    tool: {
      name: "ping",
      description: "Ping the server to check connectivity.",
      serviceName: "health-check",
    },
  },
};
