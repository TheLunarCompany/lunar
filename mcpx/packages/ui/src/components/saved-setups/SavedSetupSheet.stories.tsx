import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "@storybook/test";
import { SavedSetupSheet } from "./SavedSetupSheet";
import type { SavedSetupItem } from "@mcpx/shared-model";

const mockSetup: SavedSetupItem = {
  id: "setup-1",
  description: "Production config with GitHub and Slack",
  savedAt: new Date("2026-03-28T10:00:00Z").toISOString(),
  targetServers: {
    "my-mcp-server": { _type: "stdio", command: "npx" },
    "github-mcp": { _type: "stdio", command: "npx" },
  },
  config: {
    toolGroups: [
      {
        name: "File Operations",
        services: { "my-mcp-server": ["read_file", "write_file"] },
      },
      {
        name: "GitHub Tools",
        services: { "github-mcp": ["create_issue", "list_repos"] },
      },
    ],
  },
} as unknown as SavedSetupItem;

const meta = {
  title: "SavedSetups/SavedSetupSheet",
  component: SavedSetupSheet,
  args: {
    isOpen: true,
    onOpenChange: fn(),
    setup: mockSetup,
    onRestore: fn(),
    onOverwrite: fn(),
    onDelete: fn(),
  },
} satisfies Meta<typeof SavedSetupSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const EmptySetup: Story = {
  args: {
    setup: {
      ...mockSetup,
      targetServers: {},
      config: { toolGroups: [] },
    } as unknown as SavedSetupItem,
  },
};

export const Closed: Story = {
  args: {
    isOpen: false,
  },
};
