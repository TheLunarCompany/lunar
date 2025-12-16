import { CatalogMCPServerInput } from "@mcpx/shared-model";

export const backendDefaultServers: CatalogMCPServerInput[] = [
  {
    name: "slack",
    displayName: "Slack",
    description: "MCP server for Slack Workspaces",
    link: "https://github.com/korotovsky/slack-mcp-server",
    iconPath: "/img/slack_icon.png",
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
    name: "time",
    displayName: "Time",
    description:
      "MCP server that provides time and timezone conversion capabilities.",
    link: "https://github.com/modelcontextprotocol/servers/tree/main/src/time",
    config: {
      time: {
        command: "uvx",
        args: ["mcp-server-time"],
      },
    },
  },
  {
    name: "memory",
    displayName: "Memory",
    description:
      "A basic implementation of persistent memory using a local knowledge graph. This lets Claude remember information about the user across chats.",
    link: "https://github.com/modelcontextprotocol/servers/tree/main/src/memory",
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
    name: "playwright",
    displayName: "Playwright",
    description:
      "A Model Context Protocol (MCP) server that provides browser automation capabilities using Playwright. This server enables LLMs to interact with web pages through structured accessibility snapshots, bypassing the need for screenshots or visually-tuned models.",
    link: "https://github.com/microsoft/playwright-mcp",
    iconPath: "https://playwright.dev/img/playwright-logo.svg",
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
    name: "sequential-thinking",
    displayName: "Sequential Thinking",
    description:
      "An MCP server implementation that provides a tool for dynamic and reflective problem-solving through a structured thinking process.",
    link: "https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking",
    config: {
      "sequential-thinking": {
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
      },
    },
  },
  {
    name: "notion",
    displayName: "Notion",
    description:
      "Connect your AI tools to Notion using the Model Context Protocol (MCP), an open standard that lets AI assistants interact with your Notion workspace.",
    doc: "https://developers.notion.com/docs/get-started-with-mcp",
    config: {
      Notion: {
        type: "streamable-http",
        url: "https://mcp.notion.com/mcp",
      },
    },
  },
  {
    name: "asana",
    displayName: "Asana",
    description:
      "Asana offers a Model Context Protocol (MCP) server, accessible via app integration, which allows AI assistants and other applications to access the Asana Work Graph from beyond the Asana platform.",
    doc: "https://developers.asana.com/docs/using-asanas-mcp-server",
    config: {
      asana: {
        type: "sse",
        url: "https://mcp.asana.com/sse",
      },
    },
  },
  {
    name: "atlassian",
    displayName: "Atlassian",
    description:
      "Model Context Protocol (MCP) server for Atlassian products (Confluence and Jira)",
    link: "https://github.com/sooperset/mcp-atlassian",
    config: {
      atlassian: {
        type: "sse",
        url: "https://mcp.atlassian.com/v1/sse",
      },
    },
  },
  {
    name: "launchdarkly",
    displayName: "LaunchDarkly",
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
          "API_KEY",
        ],
        env: {
          API_KEY: "api-7ecdc5da-4e73-40be-941c-318c3100641e",
        },
      },
    },
  },
  {
    name: "context7-remote",
    displayName: "Context7",
    description:
      "Context7 MCP pulls up-to-date, version-specific documentation and code examples straight from the source — and places them directly into your prompt.",
    link: "https://github.com/upstash/context7",
    config: {
      "context7-remote": {
        type: "streamable-http",
        url: "https://mcp.context7.com/mcp",
        headers: {
          CONTEXT7_API_KEY: "YOUR_API_KEY",
        },
      },
    },
  },
  {
    name: "context7-local",
    displayName: "Context7",
    description:
      "Context7 MCP pulls up-to-date, version-specific documentation and code examples straight from the source — and places them directly into your prompt.",
    link: "https://github.com/upstash/context7",
    config: {
      "context7-local": {
        command: "npx",
        args: ["-y", "@upstash/context7-mcp", "--api-key", "YOUR_API_KEY"],
      },
    },
  },
  {
    name: "postgres",
    displayName: "PostgreSQL",
    description:
      "Connect your AI tools to PostgreSQL using the Model Context Protocol (MCP), an open standard for AI assistants to interact with your database.",
    link: "https://github.com/crystaldba/postgres-mcp",
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
    name: "snowflake",
    displayName: "Snowflake",
    description:
      "This Snowflake MCP server provides tooling for Snowflake Cortex AI, object management, and SQL orchestration, bringing these capabilities to the MCP ecosystem.",
    link: "https://github.com/Snowflake-Labs/mcp",
    config: {
      snowflake: {
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
    name: "redis",
    displayName: "Redis",
    description:
      "The Redis MCP Server is a natural language interface designed for agentic applications to efficiently manage and search data in Redis.",
    link: "https://github.com/redis/mcp-redis",
    config: {
      redis: {
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
    name: "github",
    displayName: "GitHub",
    description:
      "The GitHub MCP Server connects AI tools directly to GitHub's platform. This gives AI agents, assistants, and chatbots the ability to read repositories and code files, manage issues and PRs, analyze code, and automate workflows. All through natural language interactions.",
    link: "https://github.com/github/github-mcp-server",
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
    name: "loadmill",
    displayName: "LoadMill",
    description:
      "test-mcp is a headless MCP client for automated testing of MCP servers and agents.",
    doc: "https://github.com/loadmill/test-mcp?tab=readme-ov-file#getting-started",
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
    name: "clickup",
    displayName: "ClickUp",
    description:
      "Your AI models and agents can use our official MCP (Model Context Protocol) server to access your ClickUp data in a simple and secure way. It's designed to work seamlessly with popular AI assistants like ChatGPT, Cursor, and Claude.",
    doc: "https://help.clickup.com/hc/en-us/articles/33335772678423-What-is-ClickUp-MCP",
    config: {
      clickup: {
        type: "streamable-http",
        url: "https://mcp.clickup.com/mcp",
      },
    },
  },
  {
    name: "linear",
    displayName: "Linear",
    description:
      "The Model Context Protocol (MCP) server provides a standardized interface that allows any compatible AI model or agent to access your Linear data in a simple and secure way.",
    doc: "https://linear.app/docs/mcp",
    config: {
      linear: {
        type: "streamable-http",
        url: "https://mcp.linear.app/mcp",
      },
    },
  },
  {
    name: "sentry",
    displayName: "Sentry",
    description:
      "Enable secure connectivity between Sentry issues and debugging data, and LLM clients, using a Model Context Protocol (MCP) server.",
    doc: "https://docs.sentry.io/product/sentry-mcp/",
    config: {
      Sentry: {
        type: "streamable-http",
        url: "https://mcp.sentry.dev/mcp",
      },
    },
  },
  {
    name: "brave-search",
    displayName: "Brave",
    description:
      "An MCP server implementation that integrates the Brave Search API, providing both web and local search capabilities.",
    link: "https://github.com/modelcontextprotocol/servers-archived/tree/main/src/brave-search",
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
    name: "grafana",
    displayName: "Grafana",
    description:
      "A Model Context Protocol (MCP) server for Grafana. This provides access to your Grafana instance and the surrounding ecosystem.",
    link: "https://github.com/grafana/mcp-grafana",
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
    name: "gitlab",
    displayName: "GitLab",
    description:
      "With the GitLab Model Context Protocol (MCP) server, you can securely connect AI tools and applications to your GitLab instance.",
    doc: "https://docs.gitlab.com/user/gitlab_duo/model_context_protocol/mcp_server/",
    config: {
      GitLab: {
        command: "npx",
        args: ["mcp-remote", "https://<gitlab.example.com>/api/v4/mcp"],
      },
    },
  },
  {
    name: "aws-docs",
    displayName: "AWS Docs",
    description:
      "Model Context Protocol (MCP) server for AWS Documentation. This MCP server provides tools to access AWS documentation, search for content, and get recommendations.",
    doc: "https://awslabs.github.io/mcp/servers/aws-documentation-mcp-server",
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
  {
    name: "discord",
    displayName: "Discord",
    description:
      "Enable your AI assistants to seamlessly interact with Discord. Manage channels, send messages, and retrieve server information effortlessly.",
    config: {
      discord: {
        command: "docker",
        args: [
          "run",
          "--rm",
          "-i",
          "-e",
          "DISCORD_TOKEN=<YOUR_DISCORD_BOT_TOKEN>",
          "-e",
          "DISCORD_GUILD_ID=<OPTIONAL_DEFAULT_SERVER_ID>",
          "saseq/discord-mcp:latest",
        ],
      },
    },
  },
];
