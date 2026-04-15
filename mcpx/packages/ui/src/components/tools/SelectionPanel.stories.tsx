import type { Meta, StoryObj } from "@storybook/react-vite";
import { SelectionPanel } from "./SelectionPanel";
import { fn } from "@storybook/test";

const meta = {
  title: "Tools/SelectionPanel",
  component: SelectionPanel,
  args: {
    selectedTools: new Set(["server:tool1", "server:tool2"]),
    editingGroup: null,
    isAddCustomToolMode: false,
    originalSelectedTools: new Set<string>(),
    isSavingGroupChanges: false,
    areSetsEqual: (a: Set<string>, b: Set<string>) =>
      a.size === b.size && [...a].every((v) => b.has(v)),
    onSaveGroupChanges: fn(),
    onClearSelection: fn(),
    onCreateToolGroup: fn(),
    onCustomizeSelectedTool: fn(),
  },
} satisfies Meta<typeof SelectionPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CreateMode: Story = {};

export const EditingGroup: Story = {
  args: {
    editingGroup: { name: "File Operations" },
    selectedTools: new Set(["server:tool1", "server:tool2", "server:tool3"]),
    originalSelectedTools: new Set(["server:tool1"]),
  },
};

export const AddCustomToolMode: Story = {
  args: {
    isAddCustomToolMode: true,
    selectedTools: new Set(["server:tool1"]),
  },
};

export const SavingChanges: Story = {
  args: {
    editingGroup: { name: "File Operations" },
    selectedTools: new Set(["server:tool1", "server:tool2"]),
    originalSelectedTools: new Set(["server:tool1"]),
    isSavingGroupChanges: true,
  },
};
