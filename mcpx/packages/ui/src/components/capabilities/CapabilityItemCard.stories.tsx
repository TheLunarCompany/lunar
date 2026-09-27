import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "@storybook/test";
import { Eye, FilePenLine, Trash2 } from "lucide-react";

import { CapabilityItemCard } from "./CapabilityItemCard";
import BracketsCurlyIcon from "./icons/brackets-curly.svg?react";
import ChatsIcon from "./icons/chats.svg?react";
import GitBranchIcon from "./icons/git-branch-01.svg?react";
import PromptIcon from "./icons/prompt.svg?react";
import VinylRecordIcon from "./icons/vinyl-record.svg?react";

const meta = {
  title: "Capabilities/CapabilityItemCard",
  component: CapabilityItemCard,
  decorators: [
    (Story) => (
      <div className="min-h-[220px] bg-[var(--colors-white)] p-8">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CapabilityItemCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ToolReadOnly: Story = {
  render: () => (
    <CapabilityItemCard>
      <CapabilityItemCard.Header>
        <CapabilityItemCard.TitleBadge icon={<GitBranchIcon />}>
          create_repository
        </CapabilityItemCard.TitleBadge>
        <CapabilityItemCard.StatusBadge>
          READ ONLY
        </CapabilityItemCard.StatusBadge>
      </CapabilityItemCard.Header>

      <CapabilityItemCard.Description>
        This channel is used to monitor support tickets. All tickets containing
        customer support information...
      </CapabilityItemCard.Description>

      <CapabilityItemCard.Divider />

      <CapabilityItemCard.Metrics>
        <CapabilityItemCard.Metric
          icon={<BracketsCurlyIcon />}
          value={4}
          label="Input fields"
        />
        <CapabilityItemCard.Metric
          icon={<VinylRecordIcon className="rotate-90" />}
          value={75}
          label="Resources"
        />
      </CapabilityItemCard.Metrics>
    </CapabilityItemCard>
  ),
};

export const PromptWithMenu: Story = {
  render: () => (
    <CapabilityItemCard>
      <CapabilityItemCard.Header>
        <CapabilityItemCard.TitleBadge variant="success" icon={<PromptIcon />}>
          Web design template 1
        </CapabilityItemCard.TitleBadge>
        <CapabilityItemCard.Menu>
          <CapabilityItemCard.MenuButton />
          <CapabilityItemCard.MenuContent>
            <CapabilityItemCard.MenuItem onSelect={fn()}>
              <Eye />
              Details
            </CapabilityItemCard.MenuItem>
            <CapabilityItemCard.MenuItem onSelect={fn()}>
              <FilePenLine />
              Edit
            </CapabilityItemCard.MenuItem>
            <CapabilityItemCard.MenuItem variant="destructive" onSelect={fn()}>
              <Trash2 />
              Delete
            </CapabilityItemCard.MenuItem>
          </CapabilityItemCard.MenuContent>
        </CapabilityItemCard.Menu>
      </CapabilityItemCard.Header>

      <CapabilityItemCard.Description>
        The ID of the channel to post to
      </CapabilityItemCard.Description>

      <CapabilityItemCard.Divider />

      <CapabilityItemCard.Metrics>
        <CapabilityItemCard.Metric
          icon={<BracketsCurlyIcon />}
          value={4}
          label="Input fields"
        />
        <CapabilityItemCard.Metric
          icon={<ChatsIcon />}
          value={12}
          label="Messages"
        />
        <CapabilityItemCard.Metric
          icon={<VinylRecordIcon className="rotate-90" />}
          value={75}
          label="Resources"
        />
      </CapabilityItemCard.Metrics>
    </CapabilityItemCard>
  ),
};

export const LongTitle: Story = {
  render: () => (
    <CapabilityItemCard>
      <CapabilityItemCard.Header>
        <CapabilityItemCard.TitleBadge icon={<GitBranchIcon />}>
          create_repository_with_a_very_long_name_that_truncates
        </CapabilityItemCard.TitleBadge>
        <CapabilityItemCard.StatusBadge>
          READ ONLY
        </CapabilityItemCard.StatusBadge>
      </CapabilityItemCard.Header>

      <CapabilityItemCard.Description>
        This description keeps the same spacing and wraps without pushing the
        footer out of alignment. This description keeps the same spacing and
        wraps without pushing the footer out of alignment. This description
        keeps the same spacing and wraps without pushing the footer out of
        alignment.
      </CapabilityItemCard.Description>

      <CapabilityItemCard.Divider />

      <CapabilityItemCard.Metrics>
        <CapabilityItemCard.Metric
          icon={<BracketsCurlyIcon />}
          value={14}
          label="Input fields"
        />
        <CapabilityItemCard.Metric
          icon={<VinylRecordIcon className="rotate-90" />}
          value={175}
          label="Resources"
        />
      </CapabilityItemCard.Metrics>
    </CapabilityItemCard>
  ),
};
