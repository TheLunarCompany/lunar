import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "@storybook/test";
import { AgentProfiles } from "./AgentProfiles";
import {
  createMockAgentProfiles,
  createMockToolGroups,
} from "@/stories/mocks/data";

const mockProfiles = createMockAgentProfiles();
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
  title: "AccessControls/AgentProfiles",
  component: AgentProfiles,
  args: {
    agents: ["claude-desktop", "cursor", "windsurf", "untrusted-agent"],
    getIsAgentDisabledForProfile: fn(() => false),
    isPendingUpdateAppConfig: false,
    mcpServers: mockMcpServers,
    profiles: mockProfiles,
    setAgentsList: fn(),
    setProfiles: fn(),
    setToolGroups: fn(),
    toolGroups: mockToolGroups,
  },
} satisfies Meta<typeof AgentProfiles>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Pending: Story = {
  args: {
    isPendingUpdateAppConfig: true,
  },
};

export const SingleDefaultProfile: Story = {
  args: {
    profiles: [mockProfiles[0]],
  },
};

export const NoAgents: Story = {
  args: {
    agents: [],
    profiles: [
      {
        id: "profile-default",
        name: "default",
        permission: "allow-all",
        agents: [],
        toolGroups: [],
      },
    ],
  },
};
