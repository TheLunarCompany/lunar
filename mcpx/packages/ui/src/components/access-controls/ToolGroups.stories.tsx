import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "@storybook/test";
import { ToolGroups } from "./ToolGroups";
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
  title: "AccessControls/ToolGroups",
  component: ToolGroups,
  args: {
    isPendingUpdateAppConfig: false,
    mcpServers: mockMcpServers,
    setProfiles: fn(),
    setToolGroups: fn(),
    toolGroups: mockToolGroups,
  },
} satisfies Meta<typeof ToolGroups>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    toolGroups: [],
  },
};

export const Pending: Story = {
  args: {
    isPendingUpdateAppConfig: true,
  },
};

export const ManyGroups: Story = {
  args: {
    toolGroups: [
      ...mockToolGroups,
      {
        id: "tg-3",
        name: "Slack Tools",
        services: {
          "slack-mcp": ["send_message", "list_channels", "search_messages"],
        },
      },
      {
        id: "tg-4",
        name: "Database Tools",
        services: {
          "db-mcp": ["query", "insert", "update", "delete"],
          "redis-mcp": ["get", "set"],
        },
      },
    ],
  },
};
