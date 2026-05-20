import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "@storybook/test";
import { MultiSelect } from "./MultiSelect";

const meta = {
  title: "AccessControls/MultiSelect",
  component: MultiSelect,
  args: {
    options: [
      { label: "claude-desktop", value: "claude-desktop" },
      { label: "cursor", value: "cursor" },
      { label: "windsurf", value: "windsurf" },
      { label: "disabled-agent", value: "disabled-agent", disabled: true },
    ],
    selected: [],
    onSelectionChange: fn(),
    onCreateNew: fn(),
    disabled: false,
  },
} satisfies Meta<typeof MultiSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithSelection: Story = {
  args: {
    selected: ["claude-desktop", "cursor"],
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    selected: ["cursor"],
  },
};

export const CustomTriggerText: Story = {
  args: {
    selected: ["claude-desktop"],
    getTriggerText: (selected) =>
      selected.length > 0 ? `Agents: ${selected.join(", ")}` : "Pick agents",
  },
};

export const WithSearchPlaceholder: Story = {
  args: {
    searchPlaceholder: "Search or create an agent...",
  },
};
