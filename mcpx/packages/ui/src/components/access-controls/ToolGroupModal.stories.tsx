import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "@storybook/test";
import { ToolGroupModal } from "./ToolGroupModal";
import { createMockToolGroups } from "@/stories/mocks/data";

const mockToolGroups = createMockToolGroups();
const mockMcpServers = [
  {
    name: "my-mcp-server",
    tools: [
      { name: "read_file", description: "Read a file" },
      { name: "write_file", description: "Write a file" },
    ],
  },
  {
    name: "github-mcp",
    tools: [
      { name: "create_issue", description: "Create a GitHub issue" },
      { name: "list_repos", description: "List repositories" },
    ],
  },
];

const meta = {
  title: "AccessControls/ToolGroupModal",
  component: ToolGroupModal,
  args: {
    mcpServers: mockMcpServers,
    onClose: fn(),
    saveToolGroup: fn(),
    toolGroups: mockToolGroups,
  },
} satisfies Meta<typeof ToolGroupModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CreateNew: Story = {
  args: {
    initialData: null,
  },
};

export const EditExisting: Story = {
  args: {
    initialData: mockToolGroups[0],
  },
};
