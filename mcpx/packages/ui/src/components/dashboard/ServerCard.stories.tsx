import type { Meta, StoryObj } from "@storybook/react-vite";
import { ServerCard } from "./ServerCard";
import { withToaster } from "@/stories/decorators";
import { fn } from "@storybook/test";

import { CatalogMCPServerConfigByNameItem } from "@mcpx/toolkit-ui/src/utils/server-helpers";

const baseServer: CatalogMCPServerConfigByNameItem = {
  id: "catalog-1",
  name: "my-mcp-server",
  displayName: "My MCP Server",
  description:
    "A versatile MCP server for reading and writing files on the local filesystem.",
  link: "https://github.com/example/my-mcp-server",
  config: {
    "my-mcp-server": {
      type: "stdio",
      command: "npx",
      args: ["-y", "@example/my-mcp-server"],
      env: {
        API_KEY: { kind: "required", isSecret: true },
      },
    },
  },
};

const remoteServer: CatalogMCPServerConfigByNameItem = {
  id: "catalog-2",
  name: "remote-server",
  displayName: "Remote Server",
  description: "A remote MCP server that connects over SSE.",
  doc: "https://docs.example.com/remote-server",
  config: {
    "remote-server": {
      type: "sse",
      url: "https://api.example.com/sse",
    },
  },
};

const meta = {
  title: "Dashboard/ServerCard",
  component: ServerCard,
  decorators: [withToaster],
  args: {
    onAddServer: fn(),
  },
} satisfies Meta<typeof ServerCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    server: baseServer,
  },
};

export const WithStatus: Story = {
  args: {
    server: baseServer,
    status: "connected_running",
  },
};

export const RemoteServer: Story = {
  args: {
    server: remoteServer,
  },
};
