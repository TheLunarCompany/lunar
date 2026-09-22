import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "@storybook/test";

import { CapabilityToolCard } from "./CapabilityToolCard";
import type { CapabilityItem } from "./types";

const readOnlyItem: CapabilityItem = {
  id: "github:create_repository",
  kind: "tool",
  name: "create_repository",
  description: "Create a new repository in the selected GitHub organization.",
  providerName: "github",
  inputSchema: { type: "object" },
  annotations: { readOnlyHint: true },
};

const destructiveItem: CapabilityItem = {
  id: "github:delete_repository",
  kind: "tool",
  name: "delete_repository",
  description: "Delete an existing repository after validating ownership.",
  providerName: "github",
  inputSchema: { type: "object" },
  annotations: { destructiveHint: true },
};

const customItem: CapabilityItem = {
  id: "github:custom_repository_report",
  kind: "tool",
  name: "custom_repository_report",
  description: "Generate a repository health report with customized defaults.",
  providerName: "github",
  inputSchema: { type: "object" },
  annotations: { readOnlyHint: true },
  isCustom: true,
};

const meta = {
  title: "Capabilities/CapabilityToolCard",
  component: CapabilityToolCard,
  decorators: [
    (Story) => (
      <div className="min-h-[260px] bg-[var(--colors-white)] p-8">
        <Story />
      </div>
    ),
  ],
  args: {
    onToggleSelection: fn(),
    onShowDetails: fn(),
    onCustomizeItem: fn(),
    onEditItem: fn(),
    onDeleteItem: fn(),
  },
} satisfies Meta<typeof CapabilityToolCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OriginalTool: Story = {
  args: {
    item: readOnlyItem,
    metricCounts: {
      inputFields: 4,
      tokens: 142,
    },
  },
};

export const SelectedForGroup: Story = {
  args: {
    item: destructiveItem,
    metricCounts: {
      inputFields: 3,
    },
    isSelectionMode: true,
    isSelected: true,
  },
};

export const CustomTool: Story = {
  args: {
    item: customItem,
    metricCounts: {
      inputFields: 6,
    },
  },
};
