import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "@storybook/test";
import { ToolGroupForm } from "./ToolGroupForm";
import { FormProvider, useForm } from "react-hook-form";
import React from "react";

const mockMcpServers = [
  {
    name: "my-mcp-server",
    tools: [
      { name: "read_file", description: "Read a file from the filesystem" },
      { name: "write_file", description: "Write content to a file" },
      { name: "list_dir", description: "List directory contents" },
    ],
  },
  {
    name: "github-mcp",
    tools: [
      { name: "create_issue", description: "Create a GitHub issue" },
      { name: "list_repos", description: "List repositories" },
    ],
  },
];

function FormWrapper(props: React.ComponentProps<typeof ToolGroupForm>) {
  const form = useForm({ defaultValues: { name: "" } });
  return (
    <FormProvider {...form}>
      <ToolGroupForm {...props} />
    </FormProvider>
  );
}

const meta = {
  title: "AccessControls/ToolGroupForm",
  component: FormWrapper,
  args: {
    mcpServers: mockMcpServers,
    registerNameField: fn(),
    selectedTools: {},
    setSelectedTools: fn(),
  },
} satisfies Meta<typeof FormWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithSelectedTools: Story = {
  args: {
    selectedTools: {
      "my-mcp-server": { read_file: true, write_file: true },
    },
  },
};
