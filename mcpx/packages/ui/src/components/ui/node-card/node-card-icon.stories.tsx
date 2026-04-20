import type { Meta, StoryObj } from "@storybook/react-vite";
import { Bot, Server } from "lucide-react";
import { NodeCardIcon } from "./node-card-icon";

const meta: Meta<typeof NodeCardIcon> = {
  title: "Components/NodeCard/NodeCardIcon",
  component: NodeCardIcon,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const WithChildren: Story = {
  render: () => (
    <NodeCardIcon>
      <Bot className="size-[30px] text-[var(--colors-primary-500)]" />
    </NodeCardIcon>
  ),
};

export const WithServerIcon: Story = {
  render: () => (
    <NodeCardIcon>
      <Server className="size-[30px] text-[var(--colors-gray-500)]" />
    </NodeCardIcon>
  ),
};

export const WithImage: Story = {
  render: () => (
    <NodeCardIcon src="https://cdn.simpleicons.org/slack" alt="Slack" />
  ),
};
