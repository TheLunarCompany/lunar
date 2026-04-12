import type { Meta, StoryObj } from "@storybook/react-vite";
import { EnvVarRow } from "./EnvVarRow";
import { fn } from "@storybook/test";

const meta = {
  title: "Dashboard/EnvVarRow",
  component: EnvVarRow,
  args: {
    onValueChange: fn(),
    onKeyChange: fn(),
    disabled: false,
    isMissing: false,
  },
} satisfies Meta<typeof EnvVarRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    envKey: "API_KEY",
    value: "sk-test-key-123",
    requirement: { kind: "required", isSecret: true },
  },
};

export const Optional: Story = {
  args: {
    envKey: "OPTIONAL_VAR",
    value: "",
    requirement: { kind: "optional", isSecret: false },
  },
};

export const Fixed: Story = {
  args: {
    envKey: "ADMIN_SET_VAR",
    value: "fixed-value",
    requirement: { kind: "fixed", isSecret: false, prefilled: "fixed-value" },
  },
};

export const Missing: Story = {
  args: {
    envKey: "MISSING_KEY",
    value: "",
    requirement: { kind: "required", isSecret: false },
    isMissing: true,
  },
};
