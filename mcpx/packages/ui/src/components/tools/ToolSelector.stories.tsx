import type { Meta, StoryObj } from "@storybook/react-vite";
import { ToolSelector } from "./ToolSelector";
import { fn } from "@storybook/test";

const toolsList = [
  { name: "read_file", serviceName: "my-mcp-server" },
  { name: "write_file", serviceName: "my-mcp-server" },
  { name: "create_issue", serviceName: "github-mcp" },
  { name: "list_repos", serviceName: "github-mcp" },
  { name: "send_message", serviceName: "slack-mcp" },
];

const meta = {
  title: "Tools/ToolSelector",
  component: ToolSelector,
  args: {
    toolsList,
    onSelectionChange: fn(),
  },
} satisfies Meta<typeof ToolSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SingleServer: Story = {
  args: {
    toolsList: [
      { name: "read_file", serviceName: "my-mcp-server" },
      { name: "write_file", serviceName: "my-mcp-server" },
    ],
  },
};
