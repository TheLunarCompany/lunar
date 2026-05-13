import { http, HttpResponse } from "msw";
import type { CatalogMCPServerList } from "@mcpx/shared-model";

export const catalogMcpServers: CatalogMCPServerList = [
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
  {
    id: "0a7a551a-4a41-4a9e-8d4d-bff63a52d9a1",
    name: "atlassian",
    displayName: "Atlassian",
    description:
      "Model Context Protocol server for Atlassian products including Confluence and Jira.",
    link: "https://github.com/sooperset/mcp-atlassian",
    iconPath: "/icons/atlassian.png",
    config: {
      type: "sse",
      url: "https://atlassian.example.com/sse",
    },
  },
  {
    id: "0e7072b6-f230-4fb4-9aa5-cf7861ce8e50",
    name: "notion",
    displayName: "Notion",
    description:
      "Connect your AI tools to Notion using the Model Context Protocol.",
    link: "https://github.com/makenotion/notion-mcp-server",
    iconPath: "/icons/notion.png",
    config: {
      type: "sse",
      url: "https://notion.example.com/sse",
    },
  },
  {
    id: "4c4e89fb-e778-47c9-9909-1888b9669b9f",
    name: "linear",
    displayName: "Linear",
    description: "MCP server for Linear issues, projects, and teams.",
    link: "https://github.com/linear/linear",
    iconPath: "/icons/linear.png",
    config: {
      type: "sse",
      url: "https://linear.example.com/sse",
    },
  },
];

export const handlers = [
  http.get("*/catalog/mcp-servers", () => {
    return HttpResponse.json(catalogMcpServers);
  }),
];
