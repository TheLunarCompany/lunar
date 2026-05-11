import { http, HttpResponse } from "msw";
import type { CatalogMCPServerList } from "@mcpx/shared-model";

const catalogMcpServers: CatalogMCPServerList = [
  {
    id: "018f6f21-5f3e-7b40-a84d-c276df5b9d91",
    name: "slack",
    displayName: "Slack",
    description: "MCP server for Slack workspaces.",
    link: "https://github.com/korotovsky/slack-mcp-server",
    iconPath: "/icons/slack.png",
    config: {
      type: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-slack"],
      env: {
        SLACK_BOT_TOKEN: { kind: "required", isSecret: true },
        SLACK_TEAM_ID: { kind: "required", isSecret: false },
      },
    },
  },
  {
    id: "018f6f21-668f-7357-b1e5-7b3ba814d195",
    name: "playwright",
    displayName: "Playwright",
    description:
      "MCP server that provides browser automation capabilities using Playwright.",
    link: "https://github.com/microsoft/playwright-mcp",
    iconPath: "/icons/playwright.png",
    config: {
      type: "stdio",
      command: "docker",
      args: [
        "run",
        "-i",
        "--rm",
        "--init",
        "--pull=always",
        "mcr.microsoft.com/playwright/mcp",
      ],
      env: {},
    },
  },
  {
    id: "018f6f21-7117-70f2-beba-20a9339c4222",
    name: "context7",
    displayName: "Context7",
    description:
      "MCP server that provides up-to-date library documentation and code examples.",
    link: "https://github.com/upstash/context7",
    iconPath: "/icons/context7.png",
    config: {
      type: "stdio",
      command: "npx",
      args: ["-y", "@upstash/context7-mcp"],
      env: {},
    },
  },
];

export const handlers = [
  http.get("*/catalog/mcp-servers", () => {
    return HttpResponse.json(catalogMcpServers);
  }),
];
