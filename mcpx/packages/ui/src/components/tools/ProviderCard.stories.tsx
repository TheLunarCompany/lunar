import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProviderCard } from "./ProviderCard";
import { fn } from "@storybook/test";
import type { TargetServer } from "@mcpx/shared-model";

const connectedProvider: TargetServer = {
  _type: "stdio",
  name: "my-mcp-server",
  command: "npx",
  args: ["--port", "3000"],
  state: { type: "connected" },
  tools: [
    {
      name: "read_file",
      description: "Read a file",
      usage: { callCount: 42 },
      inputSchema: { type: "object" as const },
    },
    {
      name: "write_file",
      description: "Write a file",
      usage: { callCount: 15 },
      inputSchema: { type: "object" as const },
    },
  ],
  originalTools: [
    {
      name: "read_file",
      description: "Read a file from the filesystem",
      inputSchema: { type: "object" as const },
    },
    {
      name: "write_file",
      description: "Write content to a file",
      inputSchema: { type: "object" as const },
    },
  ],
  usage: { callCount: 57 },
} as unknown as TargetServer;

const meta = {
  title: "Tools/ProviderCard",
  component: ProviderCard,
  args: {
    provider: connectedProvider,
    isExpanded: false,
    isEditMode: false,
    isAddCustomToolMode: false,
    selectedTools: new Set<string>(),
    onProviderClick: fn(),
    onToolSelectionChange: fn(),
    onSelectAllTools: fn(),
    handleEditClick: fn(),
    handleDuplicateClick: fn(),
    handleDeleteTool: fn(),
    handleCustomizeTool: fn(),
    onToolClick: fn(),
  },
} satisfies Meta<typeof ProviderCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Collapsed: Story = {};

export const Expanded: Story = {
  args: {
    isExpanded: true,
  },
};

export const EditModeWithSelection: Story = {
  args: {
    isExpanded: true,
    isEditMode: true,
    selectedTools: new Set(["my-mcp-server:read_file"]),
  },
};

export const ConnectionFailed: Story = {
  args: {
    provider: {
      ...connectedProvider,
      name: "broken-server",
      state: { type: "connection-failed" },
    } as unknown as TargetServer,
  },
};
