import type { Meta, StoryObj } from "@storybook/react-vite";
import { McpJsonForm } from "./McpJsonForm";
import { fn } from "@storybook/test";

const simpleSchema = {
  type: "object" as const,
  properties: {
    name: { type: "string" as const },
    command: { type: "string" as const },
  },
  required: ["name", "command"],
};

const meta = {
  title: "Dashboard/McpJsonForm",
  component: McpJsonForm,
  args: {
    onChange: fn(),
    onValidate: fn(),
    schema: simpleSchema,
  },
} satisfies Meta<typeof McpJsonForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: JSON.stringify({ name: "my-server", command: "npx" }, null, 2),
  },
};

export const WithError: Story = {
  args: {
    value: '{ "name": }',
    errorMessage: "Invalid JSON: unexpected token",
  },
};

export const FillHeight: Story = {
  args: {
    value: JSON.stringify({ name: "my-server", command: "npx" }, null, 2),
    fillHeight: true,
  },
  decorators: [
    (Story) => (
      <div
        style={{ height: "400px", display: "flex", flexDirection: "column" }}
      >
        <Story />
      </div>
    ),
  ],
};
