import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter } from "react-router-dom";
import { SkillCard } from "./SkillCard";

const meta = {
  title: "Skills/SkillCard",
  component: SkillCard,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div className="max-w-sm p-6">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof SkillCard>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseSkill = {
  id: "0190a000-0000-7000-8000-000000000001",
  name: "review-pull-requests",
  description: "Review repository changes with the local project rules.",
  body: "# Review pull requests",
  exposeAsPrompt: true,
  author: { setupOwnerId: "owner-1", displayName: "Amir" },
  updatedAt: new Date("2026-06-29T10:00:00.000Z"),
} as const;

export const Default: Story = {
  args: {
    skill: baseSkill,
    onDelete: () => {},
    toolsCount: 2,
    promptsCount: 1,
  },
};

export const WithToolGroup: Story = {
  args: {
    skill: {
      ...baseSkill,
      capabilityGroup: {
        name: "Repo tools",
        items: [
          {
            catalogItemId: "0190a000-0000-7000-8000-000000000010",
            tools: "*",
            prompts: [],
          },
        ],
      },
    },
    onDelete: () => {},
    toolsCount: 12,
    promptsCount: 3,
  },
};
