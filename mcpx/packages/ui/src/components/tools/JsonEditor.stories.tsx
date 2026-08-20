import type { Meta, StoryObj } from "@storybook/react-vite";
import JsonEditor from "./JsonEditor";
import { fn } from "@storybook/test";

const meta = {
  title: "Tools/JsonEditor",
  component: JsonEditor,
  args: {
    onChange: fn(),
  },
} satisfies Meta<typeof JsonEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: JSON.stringify({ path: "/src", encoding: "utf-8" }, null, 2),
  },
};

export const WithError: Story = {
  args: {
    value: '{ "invalid": }',
    error: "Unexpected token } in JSON at position 14",
  },
};

export const Empty: Story = {
  args: {
    value: "{}",
  },
};
