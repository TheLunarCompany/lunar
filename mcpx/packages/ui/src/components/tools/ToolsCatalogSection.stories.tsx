import type { Meta, StoryObj } from "@storybook/react-vite";
import { ToolsCatalogSection } from "./ToolsCatalogSection";
import { fn } from "@storybook/test";
import {
  createMockSystemState,
  createMockToolGroups,
} from "@/stories/mocks/data";
import type { TargetServer } from "@mcpx/shared-model";

const providers = createMockSystemState()
  .targetServers as unknown as TargetServer[];
const toolGroups = createMockToolGroups().map((g) => ({
  id: g.id,
  name: g.name,
}));

const meta = {
  title: "Tools/ToolsCatalogSection",
  component: ToolsCatalogSection,
  args: {
    providers,
    selectedToolGroup: null,
    toolGroups,
    expandedProviders: new Set<string>(),
    isEditMode: false,
    isAddCustomToolMode: false,
    selectedTools: new Set<string>(),
    searchQuery: "",
    onSearchQueryChange: fn(),
    annotationFilter: [],
    onAnnotationFilterChange: fn(),
    onProviderClick: fn(),
    onToolSelectionChange: fn(),
    onSelectAllTools: fn(),
    onEditClick: fn(),
    onDuplicateClick: fn(),
    onDeleteTool: fn(),
    onCustomizeTool: fn(),
    onToolClick: fn(),
    onAddServerClick: fn(),
    onShowAllTools: fn(),
    onAddCustomToolClick: fn(),
    onEditModeToggle: fn(),
  },
} satisfies Meta<typeof ToolsCatalogSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithSearch: Story = {
  args: {
    searchQuery: "read",
  },
};

export const NoServers: Story = {
  args: {
    providers: [] as TargetServer[],
  },
};

export const WithExpandedProvider: Story = {
  args: {
    expandedProviders: new Set(["my-mcp-server"]),
  },
};
