import type { Meta, StoryObj } from "@storybook/react-vite";
import { EnvVarsEditor } from "./EnvVarsEditor";
import { withToaster } from "@/stories/decorators";
import { fn } from "@storybook/test";

const meta = {
  title: "Dashboard/EnvVarsEditor",
  component: EnvVarsEditor,
  decorators: [withToaster],
  args: {
    onSave: fn(),
    isSaving: false,
  },
} satisfies Meta<typeof EnvVarsEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    env: {
      API_KEY: "sk-test-key-123",
      DATABASE_URL: "postgres://localhost:5432/mydb",
    },
    requirements: {
      API_KEY: { kind: "required", isSecret: true },
      DATABASE_URL: { kind: "optional", isSecret: false },
    },
  },
};

export const WithMissingVars: Story = {
  args: {
    env: {
      API_KEY: "",
      SECRET_TOKEN: "",
    },
    requirements: {
      API_KEY: { kind: "required", isSecret: true },
      SECRET_TOKEN: { kind: "required", isSecret: true },
    },
    missingEnvVars: [
      { key: "API_KEY", type: "literal" },
      { key: "SECRET_TOKEN", type: "literal" },
    ],
  },
};

export const Saving: Story = {
  args: {
    env: {
      API_KEY: "sk-test-key-123",
    },
    requirements: {
      API_KEY: { kind: "required", isSecret: true },
    },
    isSaving: true,
  },
};
