import type { Meta, StoryObj } from "@storybook/react-vite";
import { ToolGroupSheet } from "./ToolGroupSheet";
import { fn } from "@storybook/test";
import {
  createMockToolGroups,
  createMockSystemState,
} from "@/stories/mocks/data";
import type { TargetServer } from "@mcpx/shared-model";

const toolGroups = createMockToolGroups();
const providers = createMockSystemState()
  .targetServers as unknown as TargetServer[];

const meta = {
  title: "Tools/ToolGroupSheet",
  component: ToolGroupSheet,
  args: {
    isOpen: true,
    onOpenChange: fn(),
    selectedToolGroup: toolGroups[0],
    toolGroups,
    providers,
    onEditGroup: fn(),
    onEditToolGroup: fn(),
    onDeleteGroup: fn(),
  },
} satisfies Meta<typeof ToolGroupSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithDescription: Story = {
  args: {
    selectedToolGroup: {
      ...toolGroups[0],
      description:
        "This group contains all tools related to file operations including reading and writing files on the local filesystem.",
    },
    toolGroups: [
      {
        ...toolGroups[0],
        description:
          "This group contains all tools related to file operations including reading and writing files on the local filesystem.",
      },
      ...toolGroups.slice(1),
    ],
  },
};

export const GitHubGroup: Story = {
  args: {
    selectedToolGroup: toolGroups[1],
  },
};
