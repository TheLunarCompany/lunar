import type { Meta, StoryObj } from "@storybook/react-vite";
import { ToolsTable } from "./ToolsTable";
import { fn } from "@storybook/test";
import { createMockToolsItems } from "@/stories/mocks/data";

const meta = {
  title: "Tools/ToolsTable",
  component: ToolsTable,
  args: {
    data: createMockToolsItems(),
    handleAddServerClick: fn(),
    handleCreateClick: fn(),
    handleDeleteTool: fn(),
    handleDetailsClick: fn(),
    handleDuplicateClick: fn(),
    handleEditClick: fn(),
  },
} satisfies Meta<typeof ToolsTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithTools: Story = {};

export const Empty: Story = {
  args: {
    data: [],
  },
};

export const CustomToolsOnly: Story = {
  args: {
    data: createMockToolsItems().filter((t) => t.isCustom),
  },
};
