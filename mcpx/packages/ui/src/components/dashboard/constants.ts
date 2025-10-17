import { MCP_ICON_COLORS } from "./SystemConnectivity/nodes";
import { AgentType, McpServerExample } from "./types";
import { editor } from "monaco-editor";

export const DEFAULT_SERVER_ICON = MCP_ICON_COLORS[0];

export function getMcpColorByName(name: string) {
  const index = name.split("").reduce((acc, word, index) => acc + word.charCodeAt(0) + index, 0) % MCP_ICON_COLORS.length;

  return MCP_ICON_COLORS[index];
}

export const AGENT_TYPES = {
  CURSOR: 'cursor',
  CLAUDE: 'claude',
  DEFAULT: 'default',
  WIND_SURF: 'windsurf',
  // Add more agent types here as needed
} as const;

export const agentsData: Record<AgentType, { icon: string; name: string }> = {
  CLAUDE: {
    icon: "/img/claude_icon_mcp.png",
    name: "Claude",
  },
  CURSOR: {
    icon: "/img/cursor_icon_mcp.jpg",
    name: "Cursor",
  },
  WIND_SURF: {
    icon: "/img/windsurf_icon_mcp.png",
    name: "Windsurf",
  },
  DEFAULT: {
    icon: "/img/default_icon_mcp.png",
    name: "Default",
  },
};

// The dashboard consists of 2 panes, which share a container and have a gap/margin.
// To get each pane's height, start from 50vh and subtract:
//  - half of top/bottom padding (1.5rem)
//  - half of margin/gap (8px)
//  - half of border width (2px)
//  - half of header (53px)
export const DASHBOARD_PANE_HEIGHT_TW_CLASS =
  "h-[calc(50vh_-_1.5rem_-_8px_-_2px_-_53px)]";
export const DASHBOARD_PANE_HEIGHT_COLLAPSED_DIAGRAM_TW_CLASS =
  "h-[calc(100vh_-_1.5rem_-_145px)]";

export const MCP_SERVER_EXAMPLES: McpServerExample[] = [
  {
    value: "slack",
    label: "Slack",
    description: "MCP server for Slack Workspaces",
    link: "https://github.com/korotovsky/slack-mcp-server",
    tools: 8,
    icon: "/img/slack_icon.png",
    config: {
      slack: {
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-slack"],
        env: {
          SLACK_BOT_TOKEN: " ",
          SLACK_TEAM_ID: " ",
        },
      },
    },
  },
  {
    value: "time",
    label: "Time",
    description:
      "MCP server that provides time and timezone conversion capabilities.",
    link: "https://github.com/modelcontextprotocol/servers/tree/main/src/time",
    tools: 2,
    config: {
      time: {
        command: "uvx",
        args: ["mcp-server-time"],
      },
    },
  },
  {
    value: "memory",
    label: "Memory",
    description:
      "A basic implementation of persistent memory using a local knowledge graph. This lets Claude remember information about the user across chats.",
    link: "https://github.com/modelcontextprotocol/servers/tree/main/src/memory",
    tools: 9,
    config: {
      memory: {
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-memory"],
        env: {
          MEMORY_FILE_PATH: "/lunar/packages/mcpx-server/config/memory.json",
        },
      },
    },
  },
  {
    value: "playwright",
    label: "Playwright",
    description:
      "A Model Context Protocol (MCP) server that provides browser automation capabilities using Playwright. This server enables LLMs to interact with web pages through structured accessibility snapshots, bypassing the need for screenshots or visually-tuned models.",
    link: "https://github.com/microsoft/playwright-mcp",
    icon: "https://playwright.dev/img/playwright-logo.svg",
    tools: 21,
    config: {
      playwright: {
        command: "docker",
        args: [
          "run",
          "-i",
          "--rm",
          "--init",
          "--pull=always",
          "mcr.microsoft.com/playwright/mcp",
        ],
      },
    },
  },
  {
    value: "sequential-thinking",
    label: "Sequential Thinking",
    description:
      "An MCP server implementation that provides a tool for dynamic and reflective problem-solving through a structured thinking process.",
    link: "https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking",
    tools: 1,
    config: {
      "sequential-thinking": {
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
      },
    },
  },
  {
    value: "notion",
    label: "Notion",
    description:
      "Connect your AI tools to Notion using the Model Context Protocol (MCP), an open standard that lets AI assistants interact with your Notion workspace.",
    doc: "https://developers.notion.com/docs/get-started-with-mcp",
    tools: 15,
    config: {
      Notion: {
        url: "https://mcp.notion.com/mcp",
      },
    },
  },
  {
    value: "asana",
    label: "Asana",
    description:
      "Asana offers a Model Context Protocol (MCP) server, accessible via app integration, which allows AI assistants and other applications to access the Asana Work Graph from beyond the Asana platform.",
    doc: "https://developers.asana.com/docs/using-asanas-mcp-server",
    tools: 43,
    config: {
      asana: {
        url: "https://mcp.asana.com/sse",
      },
    },
  },
  {
    value: "atlassian",
    label: "Atlassian",
    description:
      "Model Context Protocol (MCP) server for Atlassian products (Confluence and Jira)",
    link: "https://github.com/sooperset/mcp-atlassian",
    tools: 27,
    config: {
      atlassian: {
        url: "https://mcp.atlassian.com/v1/sse",
      },
    },
  },
  {
    value: "launchdarkly",
    label: "LaunchDarkly",
    tools: 14,
    description:
      "Connect your AI tools to LaunchDarkly using the Model Context Protocol (MCP), an open standard that lets AI assistants interact with your LaunchDarkly workspace.",
    doc: "https://launchdarkly.com/docs/home/getting-started/mcp",
    config: {
      LaunchDarkly: {
        command: "npx",
        args: [
          "-y",
          "--package",
          "@launchdarkly/mcp-server",
          "--",
          "mcp",
          "start",
          "--api-key",
          "api-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        ],
      },
    },
  },
  {
    value: "postgres",
    label: "PostgreSQL",
    description:
      "Connect your AI tools to PostgreSQL using the Model Context Protocol (MCP), an open standard for AI assistants to interact with your database.",
    link: "https://github.com/crystaldba/postgres-mcp",
    tools: 9,
    config: {
      postgres: {
        command: "docker",
        args: [
          "run",
          "-i",
          "--rm",
          "-e",
          "DATABASE_URI",
          "crystaldba/postgres-mcp",
          "--access-mode=unrestricted",
        ],
        env: {
          DATABASE_URI:
            "postgresql://username:password@localhost:5432/dbname",
        },
      },
    },
  },
  {
    value: "snowflake",
    label: "Snowflake",
    description:
      "This Snowflake MCP server provides tooling for Snowflake Cortex AI, object management, and SQL orchestration, bringing these capabilities to the MCP ecosystem.",
    link: "https://github.com/Snowflake-Labs/mcp",
    tools: 6,
    config: {
      "snowflake": {
        command: "uvx",
        args: [
          "snowflake-labs-mcp",
          "--service-config-file",
          "<path_to_file>/tools_config.yaml",
          "--connection-name",
          "default",
        ],
      },
    },
  },
  {
    value: "redis",
    label: "Redis",
    description:
      "The Redis MCP Server is a natural language interface designed for agentic applications to efficiently manage and search data in Redis.",
    link: "https://github.com/redis/mcp-redis",
    tools: 6,
    config: {
      redis: {
        command: "docker",
        args: [
          "run",
          "--rm",
          "--name",
          "redis-mcp-server",
          "-i",
          "-e",
          "REDIS_HOST=<redis_hostname>",
          "-e",
          "REDIS_PORT=<redis_port>",
          "-e",
          "REDIS_USERNAME=<redis_username>",
          "-e",
          "REDIS_PWD=<redis_password>",
          "mcp-redis",
        ],
      },
    },
  },
  {
    value: "github",
    label: "GitHub",
    description:
      "The GitHub MCP Server connects AI tools directly to GitHub's platform. This gives AI agents, assistants, and chatbots the ability to read repositories and code files, manage issues and PRs, analyze code, and automate workflows. All through natural language interactions.",
    link: "https://github.com/github/github-mcp-server",
    tools: 49,
    config: {
      GitHub: {
        type: "stdio",
        command: "docker",
        args: [
          "run",
          "-i",
          "--rm",
          "-e",
          "GITHUB_PERSONAL_ACCESS_TOKEN",
          "ghcr.io/github/github-mcp-server",
        ],
        env: {
          GITHUB_PERSONAL_ACCESS_TOKEN: " ",
        },
      },
    },
  },
];