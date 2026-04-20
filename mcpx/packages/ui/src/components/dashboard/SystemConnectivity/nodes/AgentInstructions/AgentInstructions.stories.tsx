import type { Meta, StoryObj } from "@storybook/react-vite";
import { AgentInstructions } from "./AgentInstructions";

const meta = {
  title: "Dashboard/Diagram/AgentInstructions",
  component: AgentInstructions,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 700, padding: 24 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AgentInstructions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Cursor: Story = {
  args: { agentType: "cursor" },
};

export const ClaudeDesktop: Story = {
  args: { agentType: "claudeDesktop" },
};

export const ClaudeCode: Story = {
  args: { agentType: "ClaudeCode" },
};

export const Windsurf: Story = {
  args: { agentType: "windsurf" },
};

export const VSCode: Story = {
  args: { agentType: "vscode" },
};

export const Copilot: Story = {
  args: { agentType: "copilot" },
};

export const ChatGPT: Story = {
  args: { agentType: "openai-mcp" },
};

export const N8n: Story = {
  args: { agentType: "n8n" },
};

export const Custom: Story = {
  args: { agentType: "custom" },
};

export const UnknownType: Story = {
  args: { agentType: "unknown-agent" },
};
