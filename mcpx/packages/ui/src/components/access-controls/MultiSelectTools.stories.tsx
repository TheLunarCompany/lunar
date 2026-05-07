import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "@storybook/test";
import { MultiSelectTools } from "./MultiSelectTools";

const meta = {
  title: "AccessControls/MultiSelectTools",
  component: MultiSelectTools,
  args: {
    title: "Tool Groups",
    options: [
      { id: "tg-1", name: "File Operations" },
      { id: "tg-2", name: "GitHub Tools" },
      { id: "tg-3", name: "Slack Integration" },
    ],
    selected: [],
    onSelectionChange: fn(),
    onCreateNew: fn(),
    disabled: false,
  },
} satisfies Meta<typeof MultiSelectTools>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithSelection: Story = {
  args: {
    selected: ["tg-1", "tg-2"],
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    selected: ["tg-1"],
  },
};

export const WithPlaceholder: Story = {
  args: {
    disabled: true,
    placeholder: "All Tools",
  },
};
