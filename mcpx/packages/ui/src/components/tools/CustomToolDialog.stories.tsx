import type { Meta, StoryObj } from "@storybook/react-vite";
import { CustomToolDialog } from "./CustomToolDialog";
import { fn } from "@storybook/test";

import type { Tool } from "@modelcontextprotocol/sdk/types.js";

type ProviderLike = {
  name: string;
  originalTools: Array<{
    name: string;
    description?: string | { text: string; action: "append" | "rewrite" };
    inputSchema?: Tool["inputSchema"];
  }>;
  tools?: unknown[];
  icon?: string;
};

const providers: ProviderLike[] = [
  {
    name: "my-mcp-server",
    icon: "#4078c0",
    originalTools: [
      {
        name: "read_file",
        description: "Read a file from the filesystem",
        inputSchema: {
          type: "object" as const,
          properties: {
            path: { type: "string", description: "The file path to read" },
            encoding: { type: "string", description: "File encoding" },
          },
          required: ["path"],
        },
      },
      {
        name: "write_file",
        description: "Write content to a file",
        inputSchema: {
          type: "object" as const,
          properties: {
            path: { type: "string", description: "Destination path" },
            content: { type: "string", description: "Content to write" },
          },
          required: ["path", "content"],
        },
      },
    ],
  },
];

const meta = {
  title: "Tools/CustomToolDialog",
  component: CustomToolDialog,
  args: {
    isOpen: true,
    onOpenChange: fn(),
    providers,
    onClose: fn(),
    onCreate: fn(),
  },
} satisfies Meta<typeof CustomToolDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CreateNew: Story = {
  args: {
    preSelectedServer: "my-mcp-server",
    preSelectedTool: "read_file",
  },
};

export const EditExisting: Story = {
  args: {
    preSelectedServer: "my-mcp-server",
    preSelectedTool: "read_file",
    editDialogMode: "edit",
    preFilledData: {
      name: "custom_read_file",
      description: "Custom read tool for TypeScript files only",
      parameters: [
        { name: "path", description: "File path", value: "/src" },
        { name: "encoding", description: "File encoding", value: "utf-8" },
      ],
    },
  },
};

export const Loading: Story = {
  args: {
    preSelectedServer: "my-mcp-server",
    preSelectedTool: "read_file",
    isLoading: true,
  },
};
