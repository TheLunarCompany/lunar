import type { Meta, StoryObj } from "@storybook/react-vite";
import { ToolGroupsSection } from "./ToolGroupsSection";
import { fn } from "@storybook/test";
import {
  createMockToolGroups,
  createMockSystemState,
} from "@/stories/mocks/data";
import type { TargetServer } from "@mcpx/shared-model";

const toolGroups = createMockToolGroups();
const providers = createMockSystemState()
  .targetServers as unknown as TargetServer[];

const transformedToolGroups = toolGroups.map((g) => ({
  id: g.id,
  name: g.name,
  description: g.description,
  icon: g.name === "File Operations" ? "📁" : "🐙",
  tools: Object.entries(g.services).flatMap(([provider, tools]) =>
    Array.isArray(tools)
      ? [{ name: tools.join(", "), provider, count: tools.length }]
      : [],
  ),
}));

const meta = {
  title: "Tools/ToolGroupsSection",
  component: ToolGroupsSection,
  args: {
    transformedToolGroups,
    toolGroups,
    currentGroupIndex: 0,
    selectedToolGroup: null,
    onGroupNavigation: fn(),
    onGroupClick: fn(),
    onEditModeToggle: fn(),
    onEditGroup: fn(),
    onEditToolGroup: fn(),
    isAddCustomToolMode: false,
    onDeleteGroup: fn(),
    isEditMode: false,
    providers,
    setCurrentGroupIndex: fn(),
  },
} satisfies Meta<typeof ToolGroupsSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithSelectedGroup: Story = {
  args: {
    selectedToolGroup: toolGroups[0].id,
  },
};

export const Empty: Story = {
  args: {
    transformedToolGroups: [],
  },
};
