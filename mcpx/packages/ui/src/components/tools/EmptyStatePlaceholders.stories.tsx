import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  NoToolGroupsPlaceholder,
  NoServersPlaceholder,
  NoToolsFoundPlaceholder,
} from "./EmptyStatePlaceholders";
import { fn } from "@storybook/test";

const metaNoToolGroups = {
  title: "Tools/EmptyStatePlaceholders/NoToolGroups",
  component: NoToolGroupsPlaceholder,
  args: {
    onAction: fn(),
  },
} satisfies Meta<typeof NoToolGroupsPlaceholder>;

export default metaNoToolGroups;
type Story = StoryObj<typeof metaNoToolGroups>;

export const Default: Story = {};

// Additional stories for the other placeholders as named exports with render
export const NoServers: StoryObj = {
  render: () => <NoServersPlaceholder onAction={fn()} />,
};

export const NoToolsFound: StoryObj = {
  render: () => <NoToolsFoundPlaceholder searchQuery="nonexistent-tool" />,
};

export const NoToolsFoundCustom: StoryObj = {
  render: () => <NoToolsFoundPlaceholder searchQuery="" />,
};
