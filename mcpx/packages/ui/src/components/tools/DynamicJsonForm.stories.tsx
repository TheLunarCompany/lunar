import type { Meta, StoryObj } from "@storybook/react-vite";
import DynamicJsonForm from "./DynamicJsonForm";
import { fn } from "@storybook/test";
import { withToaster } from "@/stories/decorators";
import type { JsonSchemaType } from "@/utils/jsonUtils";

const meta = {
  title: "Tools/DynamicJsonForm",
  component: DynamicJsonForm,
  decorators: [withToaster],
  args: {
    onChange: fn(),
  },
} satisfies Meta<typeof DynamicJsonForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StringFields: Story = {
  args: {
    schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "User name" },
        email: { type: "string", description: "Email address" },
      },
      required: ["name"],
    } as JsonSchemaType,
    value: { name: "Alice", email: "alice@example.com" },
  },
};

export const ArrayField: Story = {
  args: {
    schema: {
      type: "array",
      items: { type: "string", description: "A tag" },
      description: "List of tags",
    } as JsonSchemaType,
    value: ["typescript", "react"],
  },
};

export const NestedObject: Story = {
  args: {
    schema: {
      type: "object",
      properties: {
        config: {
          type: "object",
          properties: {
            timeout: { type: "number", description: "Timeout in ms" },
            retries: { type: "integer", description: "Number of retries" },
            verbose: { type: "boolean", description: "Verbose logging" },
          },
        },
      },
    } as JsonSchemaType,
    value: { config: { timeout: 5000, retries: 3, verbose: true } },
  },
};
