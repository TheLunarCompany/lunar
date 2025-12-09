import { MCP_ICON_COLORS } from "./SystemConnectivity/nodes";
import { AgentType, McpServerExample } from "./types";

export const DEFAULT_SERVER_ICON = MCP_ICON_COLORS[0];

export function getMcpColorByName(name: string) {
  const index =
    name
      .split("")
      .reduce((acc, word, index) => acc + word.charCodeAt(0) + index, 0) %
    MCP_ICON_COLORS.length;

  return MCP_ICON_COLORS[index];
}

export const AGENT_TYPES = {
  CURSOR: "cursor",
  CLAUDE: "claude",
  DEFAULT: "default",
  WIND_SURF: "windsurf",
  INSPECTOR: "inspector",
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
  INSPECTOR: {
    icon: "/img/default_icon_mcp.png",
    name: "Inspector",
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
    tools: 19,
    description:
      "Connect your AI tools to LaunchDarkly using the Model Context Protocol (MCP), an open standard that lets AI assistants interact with your LaunchDarkly workspace.",
    doc: "https://launchdarkly.com/docs/home/getting-started/mcp",
    config: {
      LaunchDarkly: {
        command: "npx",
        type: "stdio",
        args: [
          "-y",
          "--package",
          "@launchdarkly/mcp-server",
          "--",
          "mcp",
          "start",
          "--api-key",
          "API_KEY",
        ],
        env: {
          API_KEY: "api-7ecdc5da-4e73-40be-941c-318c3100641e",
        },
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
          DATABASE_URI: "postgresql://username:password@localhost:5432/dbname",
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
      snowflake: {
        type: "stdio",
        command: "uvx",
        args: [
          "snowflake-labs-mcp",
          "--service-config-file",
          "PATH_TO_FILE",
          "--connection-name",
          "default",
        ],
        env: {
          PATH_TO_FILE: "<path_to_file>/tools_config.yaml",
        },
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
        type: "stdio",
        command: "docker",
        args: ["run", "--rm", "--name", "redis-mcp-server", "-i", "mcp-redis"],
        env: {
          REDIS_HOST: "<redis_hostname>",
          REDIS_PORT: "<redis_port>",
          REDIS_USERNAME: "<redis_username>",
          REDIS_PWD: "<redis_password>",
        },
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
  {
    value: "loadmill",
    label: "LoadMill",
    description:
      "test-mcp is a headless MCP client for automated testing of MCP servers and agents.",
    doc: "https://github.com/loadmill/test-mcp?tab=readme-ov-file#getting-started",
    tools: 10,
    config: {
      loadmill: {
        type: "stdio",
        command: "npx",
        args: ["@loadmill/mcp"],
        env: {
          LOADMILL_API_TOKEN: "${env:LOADMILL_API_TOKEN}",
        },
      },
    },
  },
  {
    value: "clickup",
    label: "ClickUp",
    description:
      "Your AI models and agents can use our official MCP (Model Context Protocol) server to access your ClickUp data in a simple and secure way. It's designed to work seamlessly with popular AI assistants like ChatGPT, Cursor, and Claude.",
    doc: "https://help.clickup.com/hc/en-us/articles/33335772678423-What-is-ClickUp-MCP",
    tools: 35,
    config: {
      clickup: {
        url: "https://mcp.clickup.com/mcp",
      },
    },
  },
  {
    value: "linear",
    label: "Linear",
    description:
      "The Model Context Protocol (MCP) server provides a standardized interface that allows any compatible AI model or agent to access your Linear data in a simple and secure way.",
    doc: "https://linear.app/docs/mcp",
    tools: 23,
    config: {
      linear: {
        url: "https://mcp.linear.app/mcp",
      },
    },
  },
  {
    value: "sentry",
    label: "Sentry",
    description:
      "Enable secure connectivity between Sentry issues and debugging data, and LLM clients, using a Model Context Protocol (MCP) server.",
    doc: "https://docs.sentry.io/product/sentry-mcp/",
    tools: 14,
    config: {
      Sentry: {
        url: "https://mcp.sentry.dev/mcp",
      },
    },
  },
  {
    value: "brave-search",
    label: "Brave",
    description:
      "An MCP server implementation that integrates the Brave Search API, providing both web and local search capabilities.",
    link: "https://github.com/modelcontextprotocol/servers-archived/tree/main/src/brave-search",
    tools: 2,
    config: {
      "brave-search": {
        command: "docker",
        args: ["run", "-i", "--rm", "-e", "BRAVE_API_KEY", "mcp/brave-search"],
        env: {
          BRAVE_API_KEY: " ",
        },
      },
    },
  },
  {
    value: "grafana",
    label: "Grafana",
    description:
      "A Model Context Protocol (MCP) server for Grafana. This provides access to your Grafana instance and the surrounding ecosystem.",
    link: "https://github.com/grafana/mcp-grafana",
    tools: 47,
    config: {
      grafana: {
        command: "docker",
        args: [
          "run",
          "--rm",
          "-i",
          "-e",
          "GRAFANA_URL",
          "-e",
          "GRAFANA_API_KEY",
          "mcp/grafana",
          "-t",
          "stdio",
        ],
        env: {
          GRAFANA_URL: " ",
          GRAFANA_API_KEY: " ",
        },
      },
    },
  },
  {
    value: "gitlab",
    label: "GitLab",
    description:
      "With the GitLab Model Context Protocol (MCP) server, you can securely connect AI tools and applications to your GitLab instance.",
    doc: "https://docs.gitlab.com/user/gitlab_duo/model_context_protocol/mcp_server/",
    tools: 7,
    config: {
      GitLab: {
        command: "npx",
        args: ["mcp-remote", "https://<gitlab.example.com>/api/v4/mcp"],
      },
    },
  },
  {
    value: "aws-docs",
    label: "AWS Docs",
    description:
      "Model Context Protocol (MCP) server for AWS Documentation. This MCP server provides tools to access AWS documentation, search for content, and get recommendations.",
    doc: "https://awslabs.github.io/mcp/servers/aws-documentation-mcp-server",
    tools: 3,
    config: {
      "aws-docs": {
        type: "stdio",
        command: "uvx",
        args: ["awslabs.aws-documentation-mcp-server@latest"],
        env: {
          FASTMCP_LOG_LEVEL: "ERROR",
          AWS_DOCUMENTATION_PARTITION: "aws",
          MCP_USER_AGENT:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        },
      },
    },
  },
];
