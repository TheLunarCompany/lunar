import { CatalogMCPServerItem } from "@mcpx/shared-model";
import { v7 as uuidv7 } from "uuid";

type CatalogItemWithoutId = Omit<CatalogMCPServerItem, "id">;

const defaultServersWithoutId: CatalogItemWithoutId[] = [
  {
    name: "slack",
    displayName: "Slack",
    description: "MCP server for Slack Workspaces",
    link: "https://github.com/korotovsky/slack-mcp-server",
    iconPath: "/img/slack_icon.png",
    config: {
      type: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-slack"],
      env: {
        SLACK_BOT_TOKEN: { kind: "optional", isSecret: false },
        SLACK_TEAM_ID: { kind: "optional", isSecret: false },
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
      type: "stdio",
      command: "uvx",
      args: ["--with", "mcp<2.0.0", "mcp-server-time"],
      env: {},
    },
  },
  {
    name: "memory",
    displayName: "Memory",
    description:
      "A basic implementation of persistent memory using a local knowledge graph. This lets Claude remember information about the user across chats.",
    link: "https://github.com/modelcontextprotocol/servers/tree/main/src/memory",
    config: {
      type: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-memory"],
      env: {
        MEMORY_FILE_PATH: {
          kind: "optional",
          prefilled: "/lunar/packages/mcpx-server/config/memory.json",
          isSecret: false,
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
    name: "cloudflare-docs",
    displayName: "Cloudflare Docs",
    description: "Get up to date reference information on Cloudflare",
    link: "https://github.com/cloudflare/mcp-server-cloudflare/tree/main/apps/docs-vectorize",
    config: {
      type: "streamable-http",
      url: "https://docs.mcp.cloudflare.com/mcp",
    },
  },
  {
    name: "cloudflare-radar",
    displayName: "Cloudflare Radar",
    description:
      "Get global Internet traffic insights, trends, URL scans, and other utilities",
    link: "https://github.com/cloudflare/mcp-server-cloudflare/tree/main/apps/radar",
    config: {
      type: "streamable-http",
      url: "https://radar.mcp.cloudflare.com/mcp",
    },
  },
  {
    name: "cloudflare-gateway",
    displayName: "Cloudflare AI Gateway",
    description:
      "Search your logs, get details about the prompts and responses",
    link: "https://github.com/cloudflare/mcp-server-cloudflare/tree/main/apps/ai-gateway",
    config: {
      type: "streamable-http",
      url: "https://ai-gateway.mcp.cloudflare.com/mcp",
    },
  },
  {
    name: "cloudflare-graphql",
    displayName: "Cloudflare GraphQL",
    description:
      "Search your logs, get details about the prompts and responses",
    link: "https://github.com/cloudflare/mcp-server-cloudflare/tree/main/apps/graphql/",
    config: {
      type: "streamable-http",
      url: "https://graphql.mcp.cloudflare.com/mcp",
    },
  },
  {
    name: "sequential-thinking",
    displayName: "Sequential Thinking",
    description:
      "An MCP server implementation that provides a tool for dynamic and reflective problem-solving through a structured thinking process.",
    link: "https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking",
    config: {
      type: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
      env: {},
    },
  },
  {
    name: "notion",
    displayName: "Notion",
    description:
      "Connect your AI tools to Notion using the Model Context Protocol (MCP), an open standard that lets AI assistants interact with your Notion workspace.",
    doc: "https://developers.notion.com/docs/get-started-with-mcp",
    config: {
      type: "streamable-http",
      url: "https://mcp.notion.com/mcp",
    },
  },
  {
    name: "asana",
    displayName: "Asana",
    description:
      "Asana offers a Model Context Protocol (MCP) server, accessible via app integration, which allows AI assistants and other applications to access the Asana Work Graph from beyond the Asana platform.",
    doc: "https://developers.asana.com/docs/using-asanas-mcp-server",
    config: {
      type: "sse",
      url: "https://mcp.asana.com/sse",
    },
  },
  {
    name: "atlassian",
    displayName: "Atlassian",
    description:
      "Model Context Protocol (MCP) server for Atlassian products (Confluence and Jira)",
    link: "https://github.com/sooperset/mcp-atlassian",
    config: {
      type: "sse",
      url: "https://mcp.atlassian.com/v1/sse",
    },
  },
  {
    name: "launchdarkly",
    displayName: "LaunchDarkly",
    description:
      "Connect your AI tools to LaunchDarkly using the Model Context Protocol (MCP), an open standard that lets AI assistants interact with your LaunchDarkly workspace.",
    doc: "https://launchdarkly.com/docs/home/getting-started/mcp",
    config: {
      type: "stdio",
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
        API_KEY: {
          kind: "optional",
          prefilled: "api-XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
          isSecret: false,
        },
      },
    },
  },
  {
    name: "context7",
    displayName: "Context7",
    description:
      "Context7 MCP pulls up-to-date, version-specific documentation and code examples straight from the source — and places them directly into your prompt.",
    link: "https://github.com/upstash/context7",
    config: {
      type: "stdio",
      command: "npx",
      args: ["-y", "@upstash/context7-mcp"],
      env: {
        API_KEY: {
          kind: "optional",
          prefilled: "ctx7sk-XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
          isSecret: false,
        },
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
      type: "stdio",
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
        DATABASE_URI: {
          kind: "optional",
          prefilled: "postgresql://username:password@localhost:5432/dbname",
          isSecret: false,
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
        PATH_TO_FILE: {
          kind: "optional",
          prefilled: "<path_to_file>/tools_config.yaml",
          isSecret: false,
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
      type: "stdio",
      command: "docker",
      args: ["run", "--rm", "--name", "redis-mcp-server", "-i", "mcp-redis"],
      env: {
        REDIS_HOST: {
          kind: "optional",
          prefilled: "<redis_hostname>",
          isSecret: false,
        },
        REDIS_PORT: {
          kind: "optional",
          prefilled: "<redis_port>",
          isSecret: false,
        },
        REDIS_USERNAME: {
          kind: "optional",
          prefilled: "<redis_username>",
          isSecret: false,
        },
        REDIS_PWD: {
          kind: "optional",
          prefilled: "<redis_password>",
          isSecret: false,
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
        GITHUB_PERSONAL_ACCESS_TOKEN: { kind: "optional", isSecret: false },
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
      type: "stdio",
      command: "npx",
      args: ["@loadmill/mcp"],
      env: {
        LOADMILL_API_TOKEN: {
          kind: "optional",
          prefilled: { fromEnv: "LOADMILL_API_TOKEN" },
          isSecret: false,
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
      type: "streamable-http",
      url: "https://mcp.clickup.com/mcp",
    },
  },
  {
    name: "coda",
    displayName: "Coda",
    description:
      "MCP server that allows agents to perform actions on Coda pages, such as listing, creating, reading, updating, duplicating, and renaming.",
    link: "https://github.com/orellazri/coda-mcp",
    config: {
      type: "stdio",
      command: "npx",
      args: ["-y", "coda-mcp@latest"],
      env: {
        API_KEY: { kind: "optional", isSecret: false },
      },
    },
  },
  {
    name: "n8n-trigger-node",
    displayName: "n8n Trigger Node",
    description:
      "MCP server Trigger node acts as an entry point into n8n for MCP clients. It operates by exposing a URL that MCP clients can interact with to access n8n tools",
    doc: "https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-langchain.mcptrigger/",
    config: {
      type: "streamable-http",
      url: "YOUR_WORKFLOW_URL_HERE",
    },
  },
  {
    name: "linear",
    displayName: "Linear",
    description:
      "The Model Context Protocol (MCP) server provides a standardized interface that allows any compatible AI model or agent to access your Linear data in a simple and secure way.",
    doc: "https://linear.app/docs/mcp",
    config: {
      type: "streamable-http",
      url: "https://mcp.linear.app/mcp",
    },
  },
  {
    name: "sentry",
    displayName: "Sentry",
    description:
      "Enable secure connectivity between Sentry issues and debugging data, and LLM clients, using a Model Context Protocol (MCP) server.",
    doc: "https://docs.sentry.io/product/sentry-mcp/",
    config: {
      type: "streamable-http",
      url: "https://mcp.sentry.dev/mcp",
    },
  },
  {
    name: "brave-search",
    displayName: "Brave",
    description:
      "An MCP server implementation that integrates the Brave Search API, providing both web and local search capabilities.",
    link: "https://github.com/modelcontextprotocol/servers-archived/tree/main/src/brave-search",
    config: {
      type: "stdio",
      command: "docker",
      args: ["run", "-i", "--rm", "-e", "BRAVE_API_KEY", "mcp/brave-search"],
      env: {
        BRAVE_API_KEY: { kind: "optional", isSecret: false },
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
      type: "stdio",
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
        GRAFANA_URL: { kind: "optional", isSecret: false },
        GRAFANA_API_KEY: {
          kind: "optional",
          isSecret: false,
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
      type: "stdio",
      command: "npx",
      args: ["mcp-remote", "https://<gitlab.example.com>/api/v4/mcp"],
      env: {},
    },
  },
  {
    name: "aws-docs",
    displayName: "AWS Docs",
    description:
      "Model Context Protocol (MCP) server for AWS Documentation. This MCP server provides tools to access AWS documentation, search for content, and get recommendations.",
    doc: "https://awslabs.github.io/mcp/servers/aws-documentation-mcp-server",
    config: {
      type: "stdio",
      command: "uvx",
      args: ["awslabs.aws-documentation-mcp-server@latest"],
      env: {
        FASTMCP_LOG_LEVEL: {
          kind: "optional",
          prefilled: "ERROR",
          isSecret: false,
        },
        AWS_DOCUMENTATION_PARTITION: {
          kind: "optional",
          prefilled: "aws",
          isSecret: false,
        },
        MCP_USER_AGENT: {
          kind: "optional",
          prefilled:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          isSecret: false,
        },
      },
    },
  },
  {
    name: "coralogix",
    displayName: "Coralogix",
    description:
      "Access and query your Coralogix observability platform — logs, metrics, traces, and alerts — directly from your AI assistant.",
    doc: "https://coralogix.com/docs/user-guides/mcp-server/setup",
    config: {
      type: "streamable-http",
      url: "https://api.eu2.coralogix.com/mgmt/api/v1/mcp",
    },
  },
  {
    name: "puppeteer",
    displayName: "Puppeteer",
    description:
      "Browser automation capabilities using Puppeteer, enabling LLMs to interact with web pages, take screenshots, and run scripts.",
    link: "https://github.com/merajmehrabi/puppeteer-mcp-server",
    config: {
      type: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-puppeteer"],
      env: {},
    },
  },
  {
    name: "github-remote",
    displayName: "GitHub (Remote)",
    description:
      "Connect to the official GitHub MCP server remotely via the GitHub Copilot API, enabling AI tools to read repositories, manage issues and PRs, and automate GitHub workflows.",
    link: "https://github.com/github/github-mcp-server",
    config: {
      type: "streamable-http",
      url: "https://api.githubcopilot.com/mcp/",
    },
  },
  {
    name: "splunk",
    displayName: "Splunk",
    description:
      "Connect your AI tools to Splunk Enterprise using the Model Context Protocol, enabling natural language search and interaction with your Splunk data.",
    doc: "https://help.splunk.com/en/splunk-enterprise/mcp-server-for-splunk-platform/1.1/connecting-to-the-mcp-server-and-settings",
    config: {
      type: "stdio",
      command: "npx",
      args: [
        "-y",
        "mcp-remote",
        "https://<MCP_SERVER_ENDPOINT>",
        "--header",
        "Authorization: Bearer <YOUR_ENCRYPTED_TOKEN>",
      ],
      env: {},
    },
  },
  {
    name: "doppler",
    displayName: "Doppler",
    description:
      "Manage and access your Doppler secrets and environment variables directly from your AI assistant using the Model Context Protocol.",
    doc: "https://docs.doppler.com/docs/mcp",
    config: {
      type: "stdio",
      command: "npx",
      args: ["-y", "@dopplerhq/mcp-server"],
      env: {},
    },
  },
  {
    name: "bamboohr",
    displayName: "BambooHR",
    description:
      "Interact with your BambooHR HR data — employees, time-off, org structure, and more — directly from your AI assistant.",
    link: "https://github.com/evrimalacan/mcp-bamboohr",
    config: {
      type: "stdio",
      command: "npx",
      args: ["mcp-bamboohr@latest"],
      env: {
        BAMBOO_API_TOKEN: {
          kind: "optional",
          prefilled: "your_actual_api_token",
          isSecret: false,
        },
        BAMBOO_COMPANY_DOMAIN: {
          kind: "optional",
          prefilled: "your_company_subdomain",
          isSecret: false,
        },
      },
    },
  },
  {
    name: "hubspot",
    displayName: "HubSpot",
    description:
      "Connect your AI tools to HubSpot using Static Oauth, enabling AI assistants to interact with your HubSpot CRM, marketing, and sales data.",
    doc: "https://developers.hubspot.com/docs/apps/developer-platform/build-apps/integrate-with-the-remote-hubspot-mcp-server",
    config: {
      type: "streamable-http",
      url: "https://mcp.hubspot.com",
    },
  },
  {
    name: "clickhouse",
    displayName: "ClickHouse",
    description:
      "Connect your AI tools to ClickHouse, enabling AI assistants to query and interact with your ClickHouse databases.",
    link: "https://github.com/ClickHouse/mcp-clickhouse",
    config: {
      type: "stdio",
      command: "uvx",
      args: [
        "run",
        "--with",
        "mcp-clickhouse",
        "--python",
        "3.10",
        "mcp-clickhouse",
      ],
      env: {
        CLICKHOUSE_HOST: { kind: "optional", isSecret: false },
        CLICKHOUSE_PORT: { kind: "optional", isSecret: false },
        CLICKHOUSE_USER: { kind: "optional", isSecret: false },
        CLICKHOUSE_PASSWORD: { kind: "optional", isSecret: false },
        CLICKHOUSE_SECURE: {
          kind: "optional",
          prefilled: "true",
          isSecret: false,
        },
        CLICKHOUSE_VERIFY: {
          kind: "optional",
          prefilled: "true",
          isSecret: false,
        },
      },
    },
  },
  {
    name: "launchdarkly-ai-configs",
    displayName: "LaunchDarkly AI Configs",
    description:
      "Connect your AI tools to LaunchDarkly AI Configs, enabling AI assistants to manage and interact with your AI model configurations.",
    doc: "https://launchdarkly.com/docs/home/getting-started/mcp-hosted#manual-configuration",
    config: {
      type: "streamable-http",
      url: "https://mcp.launchdarkly.com/mcp/aiconfigs",
    },
  },
  {
    name: "launchdarkly-feature-management",
    displayName: "LaunchDarkly Feature Management",
    description:
      "Connect your AI tools to LaunchDarkly Feature Management, enabling AI assistants to manage feature flags and control feature rollouts.",
    doc: "https://launchdarkly.com/docs/home/getting-started/mcp-hosted#manual-configuration",
    config: {
      type: "streamable-http",
      url: "https://mcp.launchdarkly.com/mcp/fm",
    },
  },
  {
    name: "launchdarkly-observability",
    displayName: "LaunchDarkly Observability",
    description:
      "Connect your AI tools to LaunchDarkly Observability, enabling AI assistants to monitor and analyze your application's performance and reliability data.",
    doc: "https://launchdarkly.com/docs/home/getting-started/mcp-hosted#manual-configuration",
    config: {
      type: "streamable-http",
      url: "https://mcp.launchdarkly.com/mcp/observability",
    },
  },
  {
    name: "figma-community",
    displayName: "Figma (Community)",
    description:
      "Gives AI coding agents access to Figma design data, simplifying and translating responses so only the most relevant layout and styling information is provided to the model.",
    link: "https://github.com/glips/figma-context-mcp",
    config: {
      type: "stdio",
      command: "npx",
      args: [
        "-y",
        "figma-developer-mcp",
        "--image-dir=/tmp/figma-images",
        "--stdio",
      ],
      env: { FIGMA_API_KEY: { kind: "required", isSecret: false } },
    },
  },
  {
    name: "fathom",
    displayName: "Fathom",
    description:
      "Connect your meeting data to LLMs using the Model Context Protocol. Enables AI assistants to access and analyze your Fathom meeting recordings, transcripts, and summaries.",
    doc: "https://developers.fathom.ai/mcp-docs",
    config: { type: "streamable-http", url: "https://api.fathom.ai/mcp" },
  },
  {
    name: "n8n-workflows-builder",
    displayName: "n8n Workflows Builder (Community)",
    description:
      "Provides n8n knowledge to MCP clients from anywhere by connecting AI assistants to your self-hosted n8n instance over HTTP, with optional workflow management tools.",
    link: "https://github.com/czlonkowski/n8n-mcp/blob/main/docs/HTTP_DEPLOYMENT.md",
    config: {
      type: "streamable-http",
      url: "YOUR_N8N_INSTANCE_URL",
      headers: { Authorization: "Bearer YOUR_AUTH_TOKEN" },
    },
  },
  {
    name: "apollo-io",
    displayName: "Apollo.io",
    description:
      "Access Apollo's 230M+ contact database and sales engagement tools through natural language. Search for prospects and companies, enrich records, create contacts, and manage sequences directly from your AI assistant.",
    doc: "https://docs.apollo.io/docs/apollo-mcp",
    config: { type: "streamable-http", url: "https://mcp.apollo.io/mcp" },
  },
  {
    name: "slack-remote",
    displayName: "Slack (Remote)",
    description:
      "Official Slack MCP server using the Static OAuth flow. Lets AI assistants securely access your Slack workspace to search messages, find information, and take actions on your behalf.",
    doc: "https://slack.com/help/articles/48855576908307-Guide-to-the-Slack-MCP-server",
    config: { type: "streamable-http", url: "https://mcp.slack.com/mcp" },
  },
  {
    name: "wiz",
    displayName: "Wiz",
    description:
      "Enhances natural language understanding and powers automated workflows across the Wiz platform. It seamlessly translates plain-language queries into Wiz-specific operations, such as querying resources, assessing risks, and retrieving data from third-party security tools. Designed to complement our in-product AI assistant, Mika AI, the Wiz MCP Server adds robustness and simplifies integration with external systems.",
    doc: "https://app.wiz.io/login?redirect=%2Fdocs%2Fconnect-remote-wiz-mcp-server",
    config: { type: "streamable-http", url: "https://mcp.app.wiz.io" },
  },
  {
    name: "monday",
    displayName: "monday.com",
    description:
      "monday.com's open framework for connecting agents into your work OS - giving them secure access to structured data, tools to take action, and the context needed to make smart decisions.",
    link: "https://github.com/mondaycom/mcp",
    config: { type: "streamable-http", url: "https://mcp.monday.com/mcp" },
  },
  {
    name: "intercom",
    displayName: "Intercom",
    description:
      "Connect your AI tools to Intercom, enabling AI assistants to manage and interact with Intercom API.",
    link: "https://github.com/intercom/intercom-mcp-server",
    config: {
      type: "stdio",
      command: "npx",
      args: ["mcp-remote", "https://mcp.intercom.com/mcp"],
      env: {},
    },
  },
  {
    name: "webflow",
    displayName: "Webflow",
    description:
      "Connects agents and AI tools directly to your Webflow projects. Import designs, create pages, analyze site activity, work with the CMS and more from your preferred AI environment.",
    doc: "https://developers.webflow.com/mcp/reference/overview",
    config: { type: "streamable-http", url: "https://mcp.webflow.com/mcp" },
  },
  {
    name: "clarity",
    displayName: "Microsoft Clarity",
    description:
      "Clarity MCP server acts as an analytics data bridge, making it incredibly easy to query Clarity's web metrics using natural language. Ask plain-text questions and get clean, actionable analytics within seconds.",
    doc: "https://clarity.microsoft.com/blog/introducing-the-microsoft-clarity-mcp-server-a-smarter-way-to-fetch-analytics-with-ai/",
    config: {
      type: "stdio",
      command: "npx",
      args: ["@microsoft/clarity-mcp-server"],
      env: {
        clarity_api_token: {
          kind: "required",
          prefilled: "your-api-token-here",
          isSecret: false,
        },
      },
    },
  },
  {
    name: "chili-piper",
    displayName: "Chili Piper",
    description:
      "Let your AI assistant read and manage your Chili Piper data – users, meetings, routing rules, distributions, and more.",
    doc: "https://help.chilipiper.com/hc/en-us/articles/50430350863635-How-do-I-connect-Chili-Piper-via-MCP",
    config: {
      type: "streamable-http",
      url: "https://fire.chilipiper.com/api/fire-edge/v1/org/mcp",
      headers: { Authorization: "Bearer {{YOUR_API_KEY}}" },
    },
  },
  {
    name: "salesforce",
    displayName: "Salesforce",
    description:
      "Note: Server URL format: For All production orgs: https://api.salesforce.com/platform/mcp/v1/<SERVER-NAME>. For sandbox or scratch orgs: https://api.salesforce.com/platform/mcp/v1/sandbox/<SERVER-NAME>. Salesforce MCP Servers give AI agents a secure, governed way to interact with Salesforce data and automation. Configure a server once in Salesforce and any MCP-compatible client can connect to it using standard OAuth-based authentication.",
    doc: "https://developer.salesforce.com/docs/platform/hosted-mcp-servers/guide/hosted-mcp-servers-overview.html",
    config: {
      type: "streamable-http",
      url: "https://api.salesforce.com/platform/mcp/v1/<SERVER-NAME>",
      headers: { CLIENT_ID: { fromEnv: "CONSUMER-KEY" } },
    },
  },
  {
    name: "posthog",
    displayName: "PostHog",
    description:
      "Let your AI agent use PostHog - with just plain text questions your agents can ship a feature flag from a prompt, dig into a stack trace without leaving your editor, run a HogQL query through Claude, triage a support ticket, set up a CDP destination, and much more.",
    doc: "https://posthog.com/docs/model-context-protocol",
    config: { type: "streamable-http", url: "https://mcp.posthog.com/mcp" },
  },
  {
    name: "zoom",
    displayName: "Zoom",
    description:
      "Zoom MCP servers using the Static OAuth flow and map to specific Zoom product areas, such as Meetings, Chat, or Whiteboard. External MCP clients (AI agents) connect to Zoom MCP servers, and enable users to interact with Zoom resources through natural language-for example, to schedule meetings, generate summaries, and automate Zoom workflows.",
    doc: "https://developers.zoom.us/docs/mcp/servers/connect-to-zoom-mcp-servers/",
    config: {
      type: "streamable-http",
      url: "https://mcp.zoom.us/mcp/zoom/streamable",
    },
  },
  {
    name: "excalidraw",
    displayName: "Excalidraw",
    description:
      "Excalidraw creates interactive hand-drawn diagrams from assistant conversations. Its MCP connector gives users a way to turn ideas, flows, and sketches into editable visual diagrams inside Excalidraw.",
    doc: "https://mcpservers.org/remote-mcp-servers/excalidraw-app-demo",
    config: {
      type: "streamable-http",
      url: "https://excalidraw-mcp-app.vercel.app/mcp",
    },
  },
  {
    name: "netlify",
    displayName: "Netlify",
    description:
      "Connect to the Netlify MCP server to equip your agent with the best of Netlify expertise and the Netlify CLI.",
    doc: "https://docs.netlify.com/build/build-with-ai/agent-setup-guides/agent-setup-overview/",
    config: {
      type: "streamable-http",
      url: "https://netlify-mcp.netlify.app/mcp",
    },
  },
  {
    name: "base44",
    displayName: "Base44",
    description:
      "The Base44 MCP server exposes your Base44 account to any MCP-compatible AI assistant. Once connected, you can describe what you want to build or change and the AI will create or update projects on your behalf. Note: requires setting the redirect URI.",
    doc: "https://docs.base44.com/developers/backend/overview/mcp-server",
    config: {
      type: "streamable-http",
      url: "https://app.base44.com/mcp",
    },
  },
  {
    name: "minimax",
    displayName: "MiniMax",
    description:
      "MiniMax MCP provides image generation, video generation, text-to-speech, and more.",
    link: "https://github.com/MiniMax-AI/MiniMax-MCP-JS",
    config: {
      type: "stdio",
      command: "uvx",
      args: ["minimax-mcp", "-y"],
      env: {
        MINIMAX_API_KEY: { kind: "required", isSecret: false },
        MINIMAX_MCP_BASE_PATH: {
          kind: "required",
          prefilled: "local-output-dir-path, such as /User/xxx/Desktop",
          isSecret: false,
        },
        MINIMAX_API_HOST: {
          kind: "optional",
          prefilled: "https://api.minimax.io | https://api.minimaxi.com",
          isSecret: false,
        },
        MINIMAX_API_RESOURCE_MODE: {
          kind: "optional",
          prefilled: "local-url",
          isSecret: false,
        },
      },
    },
  },
  {
    name: "context7-remote",
    displayName: "Context7 (Remote)",
    description:
      "Context7 brings up-to-date, version-specific library documentation into your AI coding assistant.",
    doc: "https://context7.com/docs/resources/all-clients#cursor",
    config: {
      type: "streamable-http",
      url: "https://mcp.context7.com/mcp",
      headers: { CONTEXT7_API_KEY: { fromEnv: "YOUR_API_KEY" } },
    },
  },
  {
    name: "neon",
    displayName: "Neon",
    description:
      "Neon integrates with AI coding tools and agents through MCP. Pick your editor for setup and integration details.",
    doc: "https://neon.com/guides/cursor-mcp-neon",
    config: {
      type: "streamable-http",
      url: "https://mcp.neon.tech/mcp",
    },
  },
  {
    name: "parallel",
    displayName: "Parallel",
    description:
      "The Parallel MCP Servers expose Parallel APIs to AI assistants and large language model (LLM) workflows, delivering high-quality, relevant results from the web while optimizing for the price-performance balance your AI applications need at scale.",
    doc: "https://docs.parallel.ai/integrations/mcp/quickstart",
    config: {
      type: "streamable-http",
      url: "https://task-mcp.parallel.ai/mcp",
    },
  },
  {
    name: "supabase",
    displayName: "Supabase",
    description:
      "Once connected, your AI assistants can interact with and query your Supabase projects on your behalf.",
    doc: "https://supabase.com/docs/guides/ai-tools/mcp",
    config: {
      type: "streamable-http",
      url: "https://mcp.supabase.com/mcp?features=docs%2Caccount%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions%2Cbranching",
    },
  },
  {
    name: "canva",
    displayName: "Canva",
    description:
      "The Canva MCP server enables AI assistants to seamlessly interact with Canva's design capabilities. By exposing Canva's capabilities (including design creation and editing, asset and brand management, library search, export, and commenting) as MCP-compatible tools, you can give your users access to Canva's design capabilities through natural language, directly from the AI tools they already use.",
    doc: "https://www.canva.dev/docs/mcp/",
    config: {
      type: "streamable-http",
      url: "https://mcp.canva.com/mcp",
    },
  },
  {
    name: "amplitude",
    displayName: "Amplitude",
    description:
      "Amplitude MCP exposes Amplitude analytics, taxonomy, and content as tools that an AI client (Cursor, Claude, ChatGPT, Codex, Gemini, and others) can call over OAuth. It reads and writes charts, dashboards, experiments, cohorts, events, and properties from natural-language prompts, so you query and edit product data without SQL or the Amplitude UI.",
    doc: "https://amplitude.com/docs/amplitude-ai/amplitude-mcp",
    config: {
      type: "streamable-http",
      url: "https://mcp.amplitude.com/mcp",
    },
  },
  {
    name: "calendly",
    displayName: "Calendly",
    description:
      "You can connect Calendly to AI tools like Claude or ChatGPT to manage scheduling directly from your conversation. MCP powers this connection behind the scenes, so your AI tool can take actions in your Calendly account.",
    doc: "https://calendly.com/help/connect-calendly-to-your-ai-tools",
    config: {
      type: "streamable-http",
      url: "https://mcp.calendly.com",
    },
  },
  {
    name: "factset",
    displayName: "FactSet",
    description:
      "AI-Ready Data MCP helps investment research, market data, application development, and GenAI product builders accelerate LLM-powered analytics, research automation, and intelligent workflow applications, by enabling direct interaction between large language models and FactSet content through standardized MCP tool interfaces.",
    doc: "https://developer.factset.com/mcp/factset-ai-ready-data-mcp",
    config: {
      type: "streamable-http",
      url: "https://mcp.factset.com/content/v1",
    },
  },
  {
    name: "grain",
    displayName: "Grain",
    description:
      "Grain captures and enriches your meetings, then delivers them to Claude, ChatGPT, or any AI tool so your agents can do the work. Start recording in minutes.",
    doc: "https://grain.com/release-note/06-18-2025",
    config: {
      type: "streamable-http",
      url: "https://api.grain.com/_/mcp",
    },
  },
  {
    name: "honeycomb",
    displayName: "Honeycomb",
    description:
      "Honeycomb provides observability data and SLO context for engineering teams. Its connector helps assistants query telemetry, explore service behavior, and reason about reliability questions using Honeycomb data.",
    doc: "https://docs.honeycomb.io/integrations/mcp",
    config: {
      type: "streamable-http",
      url: "https://mcp.honeycomb.io/mcp",
    },
  },
  {
    name: "next-devtools",
    displayName: "Next.js DevTools",
    description:
      "The Model Context Protocol (MCP) is an open standard that allows AI agents and coding assistants to interact with your applications through a standardized interface.",
    doc: "https://nextjs.org/docs/app/guides/mcp",
    config: {
      type: "stdio",
      command: "npx",
      args: ["-y", "next-devtools-mcp@latest"],
      env: {},
    },
  },
  {
    name: "instacart-dev",
    displayName: "Instacart (Dev)",
    description:
      "MCP lets your AI agent or LLM learn the input parameters needed for our APIs, and automatically generate the proper input to our MCP server.",
    doc: "https://docs.instacart.com/developer_platform_api/guide/tutorials/mcp",
    config: {
      type: "streamable-http",
      url: "https://mcp.dev.instacart.tools/mcp",
      headers: { Authorization: "Bearer Token {{YOUR_TOKEN_HERE}}" },
    },
  },
  {
    name: "wix",
    displayName: "Wix",
    description:
      "Website builder and hosting platform with a built-in CMS and e-commerce. Build and manage sites, edit content and collections, and work with store and booking data. OAuth. Read+write on your sites.",
    doc: "https://dev.wix.com/docs/sdk/articles/use-the-wix-mcp/about-the-wix-mcp",
    config: { type: "streamable-http", url: "https://mcp.wix.com/mcp" },
  },
  {
    name: "huggingface",
    displayName: "HuggingFace",
    description:
      "Open-source AI platform hosting models, datasets and demo apps - the central hub for the ML community. Search and explore models, datasets, papers and Spaces, and reach Gradio-hosted MCP servers.",
    doc: "https://huggingface.co/docs/hub/en/agents-mcp",
    config: {
      type: "streamable-http",
      url: "https://huggingface.co/mcp",
      headers: { Authorization: "Bearer {{HF_TOKEN}}" },
    },
  },
  {
    name: "x-docs",
    displayName: "X.com Docs",
    description:
      "Developer documentation for the X API - endpoint references, authentication guides and code examples. Two tools: search across the documentation, and retrieve a full page by path. No authentication. Read-only, no account access.",
    doc: "https://docs.x.com/tools/mcp",
    config: { type: "streamable-http", url: "https://docs.x.com/mcp" },
  },
  {
    name: "stripe",
    displayName: "Stripe",
    description:
      "Payment processing platform for online businesses - payments, subscriptions, invoicing, and payouts. Query and manage customers, charges, subscriptions, products and pricing. Read+write on live payment data.",
    doc: "https://docs.stripe.com/mcp",
    config: {
      type: "streamable-http",
      url: "https://mcp.stripe.com",
      headers: {
        Authorization: "Bearer {{rk_.....}}",
        "Stripe-Account": { fromEnv: "CONSUMER-acct_xxxxxxxxx" },
      },
    },
  },
  {
    name: "semrush",
    displayName: "SEMrush",
    description:
      "SEO and competitive marketing intelligence - keyword research, backlink analysis, rank tracking and competitor traffic estimates.",
    doc: "https://developer.semrush.com/api/v4/introduction/semrush-mcp/",
    config: {
      type: "streamable-http",
      url: "https://mcp.semrush.com/v2/mcp",
      headers: { Authorization: "Apikey {{YOUR_API_KEY}}" },
    },
  },
  {
    name: "apify",
    displayName: "Apify",
    description:
      "A marketplace of pre-built scrapers called Actors, plus the infrastructure to run them. The agent can run a scraper against a site and get structured data back, rather than parsing HTML itself. Covers the common targets (search results, social, maps, e-commerce) without you writing extraction code. Read+write, since runs cost credits.",
    doc: "https://mcp.apify.com/",
    config: { type: "streamable-http", url: "https://mcp.apify.com" },
  },
  {
    name: "axiom",
    displayName: "Axiom",
    description:
      "Log and event analytics with its own query language (APL). The agent runs queries over ingested logs and events. Broader and cheaper than Honeycomb for plain log search; less specialised for tracing. Read-only.",
    doc: "https://axiomdecisions.com/docs/reference/agent-intergration",
    config: { type: "streamable-http", url: "https://mcp.axiom.co/mcp" },
  },
  {
    name: "prisma",
    displayName: "Prisma",
    description:
      "The TypeScript ORM, plus Prisma Postgres, their managed database. The server goes beyond docs: an agent can spin up new database instances and run schema migrations. Worth flagging in your catalog that this provisions real infrastructure. Read+write.",
    doc: "https://www.prisma.io/docs/ai/tools/mcp-server",
    config: { type: "streamable-http", url: "https://mcp.prisma.io/mcp" },
  },
  {
    name: "sanity",
    displayName: "Sanity",
    description:
      "Headless CMS built on a structured content lake rather than fixed page templates. The agent can create and query content, and manage datasets, schemas and releases - meaning it can change the content model, not just the content. Read+write.",
    doc: "https://www.sanity.io/docs/ai/mcp-server",
    config: { type: "streamable-http", url: "https://mcp.sanity.io" },
  },
  {
    name: "statsig",
    displayName: "Statsig",
    description:
      "Feature flags and experimentation. The agent can read and manage gates and experiments, and pull results. The useful pairing is shipping a change behind a flag and then reading its own experiment readout. Read+write.",
    doc: "https://docs.statsig.com/integrations/mcp/overview",
    config: { type: "streamable-http", url: "https://api.statsig.com/v1/mcp" },
  },
  {
    name: "replicate",
    displayName: "Replicate",
    description:
      "Run open-source models through a hosted API - image generation, transcription, upscaling, and so on. The agent can search and compare models and actually invoke them, so it's a capability extension rather than a data source. Read+write, and runs cost money per call.",
    doc: "https://mcp.replicate.com",
    config: { type: "sse", url: "https://mcp.replicate.com/sse" },
  },
  {
    name: "microsoft-learn-docs",
    displayName: "Microsoft Learn",
    description:
      "Official Microsoft documentation for Azure, .NET, C#, Microsoft 365 and SQL Server. Documentation search only - no access to your Azure resources or tenant. No auth required.",
    doc: "https://learn.microsoft.com/en-us/training/support/mcp",
    config: {
      type: "streamable-http",
      url: "https://learn.microsoft.com/api/mcp",
    },
  },
  {
    name: "render",
    displayName: "Render",
    description:
      "Managed cloud hosting for web services, static sites, workers, cron jobs and Postgres. Inspect services, check deploy status, read build and runtime logs. Requires an API key. Read+write on your infrastructure.",
    doc: "https://render.com/docs/mcp-server",
    config: {
      type: "streamable-http",
      url: "https://mcp.render.com/mcp",
      headers: { Authorization: "Bearer {{YOUR_API_KEY}}" },
    },
  },
  {
    name: "zapier",
    displayName: "Zapier",
    description:
      "Workflow automation platform connecting 8,000+ apps with 30,000+ actions. Trigger actions across your connected apps - create records, send messages, update spreadsheets - without building integrations. Each user generates their own scoped URL. Read+write on connected apps.",
    doc: "https://docs.zapier.com/mcp/home",
    config: {
      type: "streamable-http",
      url: "https://mcp.zapier.com/api/v1/connect",
    },
  },
  {
    name: "clay",
    displayName: "Clay",
    description:
      "Find and enrich people and companies across 150+ data providers, run AI research agents, and trigger your team's approved Clay workflows - via Clay's official hosted MCP server.",
    doc: "https://university.clay.com/docs/connect-to-clay-mcp",
    config: { type: "streamable-http", url: "https://api.clay.com/v3/mcp" },
  },
  {
    name: "hygraph",
    displayName: "HyGraph",
    description:
      "Instead of setting up everything manually in Studio, you describe what you want in plain language. Tasks that previously required a developer, such as bulk content updates, schema creation, and cross-environment migrations, can now be done with a single prompt.",
    doc: "https://hygraph.com/docs/hygraph-ai/mcp-server",
    config: {
      type: "streamable-http",
      url: "https://mcp-{REGION}.hygraph.com/{PROJECT_ID}/{ENVIRONMENT}/mcp",
      headers: { Authorization: "Bearer {{HYGRAPH_TOKEN}}" },
    },
  },
];

export const backendDefaultServers: CatalogMCPServerItem[] =
  defaultServersWithoutId.map((server) => ({
    ...server,
    id: uuidv7(),
  }));
