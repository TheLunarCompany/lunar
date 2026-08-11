import type { Meta, StoryObj } from "@storybook/react-vite";
import { HierarchyBadge } from "./HierarchyBadge";

const meta = {
  title: "Components/HierarchyBadge",
  component: HierarchyBadge,
} satisfies Meta<typeof HierarchyBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ServerOnly: Story = {
  args: {
    serverName: "github-server",
  },
};

export const ServerAndTool: Story = {
  args: {
    serverName: "github-server",
    toolName: "create_pull_request",
  },
};

export const LongNames: Story = {
  args: {
    serverName: "my-very-long-server-name-that-should-truncate-nicely",
    toolName: "a_really_long_tool_name_that_also_truncates_at_some_point",
  },
};
