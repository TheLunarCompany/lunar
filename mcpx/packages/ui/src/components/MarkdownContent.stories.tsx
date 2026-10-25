import type { Meta, StoryObj } from "@storybook/react-vite";
import { MarkdownContent } from "./MarkdownContent";

const meta = {
  title: "Components/MarkdownContent",
  component: MarkdownContent,
} satisfies Meta<typeof MarkdownContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    content:
      "# Hello World\n\nThis is a **bold** statement and some `inline code`.\n\n- Item one\n- Item two\n- Item three",
  },
};

export const RichContent: Story = {
  args: {
    content: `## Tool Description

This tool allows you to **create pull requests** on GitHub.

### Parameters

1. \`title\` - The PR title
2. \`body\` - The PR description
3. \`base\` - Target branch

> Note: All parameters are required.

\`\`\`json
{
  "title": "Fix bug",
  "body": "Resolves #123",
  "base": "main"
}
\`\`\`

Visit [GitHub](https://github.com) for more info.`,
  },
};

export const Truncated: Story = {
  args: {
    content:
      "This is a long description that should be truncated after a few lines. It contains multiple sentences to demonstrate the truncation behavior. The content goes on and on to show how the component handles overflow.",
    truncate: true,
    maxLines: 2,
  },
};
