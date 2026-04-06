import type { McpServer, Agent, ToolDetails, McpServerStatus } from "@/types";
import type { ToolsItem } from "@/types/tools";
import type { AgentProfile, ToolGroup } from "@/store/access-controls";
import type { ServerTool, CustomTool } from "@/store/tools";
import type { AppConfig, SystemState } from "@mcpx/shared-model";

// ── MCP Servers ──────────────────────────────────────────────────────────────

export function createMockMcpServer(
  overrides: Partial<McpServer> = {},
): McpServer {
  return {
    id: "server-1",
    name: "my-mcp-server",
    args: ["--port", "3000"],
    command: "npx",
    status: "connected_running" as McpServerStatus,
    type: "stdio",
    tools: [
      {
        name: "read_file",
        description: "Read a file",
        invocations: 42,
        lastCalledAt: new Date(),
      },
      {
        name: "write_file",
        description: "Write a file",
        invocations: 15,
        lastCalledAt: new Date(),
      },
    ],
    usage: { callCount: 57, lastCalledAt: new Date() },
    env: { API_KEY: "sk-test-key" },
    ...overrides,
  };
}

export function createMockMcpServers(): McpServer[] {
  return [
    createMockMcpServer(),
    createMockMcpServer({
      id: "server-2",
      name: "github-mcp",
      status: "connected_running",
      icon: "#4078c0",
      tools: [
        {
          name: "create_issue",
          description: "Create a GitHub issue",
          invocations: 10,
          lastCalledAt: new Date(),
        },
        {
          name: "list_repos",
          description: "List repositories",
          invocations: 5,
          lastCalledAt: null,
        },
      ],
      usage: { callCount: 15, lastCalledAt: new Date() },
    }),
    createMockMcpServer({
      id: "server-3",
      name: "slack-mcp",
      status: "connecting",
      tools: [],
      usage: { callCount: 0 },
    }),
    createMockMcpServer({
      id: "server-4",
      name: "broken-server",
      status: "connection_failed",
      connectionError: "Connection refused: ECONNREFUSED 127.0.0.1:5000",
      tools: [],
      usage: { callCount: 0 },
    }),
    createMockMcpServer({
      id: "server-5",
      name: "auth-server",
      status: "pending_auth",
      tools: [],
      usage: { callCount: 0 },
    }),
  ];
}

// ── Agents ───────────────────────────────────────────────────────────────────

export function createMockAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "agent-1",
    identifier: "claude-desktop",
    sessionIds: ["session-abc-123"],
    status: "connected",
    lastActivity: new Date(),
    llm: { provider: "anthropic", model: "claude-sonnet-4-20250514" },
    usage: { callCount: 120, lastCalledAt: new Date() },
    ...overrides,
  };
}

export function createMockAgents(): Agent[] {
  return [
    createMockAgent(),
    createMockAgent({
      id: "agent-2",
      identifier: "cursor",
      sessionIds: ["session-def-456", "session-ghi-789"],
      llm: { provider: "anthropic", model: "claude-sonnet-4-20250514" },
      usage: { callCount: 85, lastCalledAt: new Date() },
    }),
    createMockAgent({
      id: "agent-3",
      identifier: "windsurf",
      sessionIds: ["session-jkl-012"],
      llm: { provider: "openai", model: "gpt-4o" },
      usage: { callCount: 30, lastCalledAt: new Date() },
    }),
  ];
}

// ── Tools ────────────────────────────────────────────────────────────────────

export function createMockServerTool(
  overrides: Partial<ServerTool> = {},
): ServerTool {
  return {
    id: "my-mcp-server/read_file",
    name: "read_file",
    description: "Read a file from the filesystem",
    serviceName: "my-mcp-server",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "The file path to read" },
      },
      required: ["path"],
    },
    ...overrides,
  };
}

export function createMockToolDetails(
  overrides: Partial<ToolDetails> = {},
): ToolDetails {
  return {
    name: "read_file",
    description: "Read a file from the filesystem",
    serviceName: "my-mcp-server",
    params: [
      { name: "path", type: "string", description: "The file path to read" },
    ],
    ...overrides,
  };
}

export function createMockToolsItems(): ToolsItem[] {
  return [
    {
      name: "read_file",
      description: {
        text: "Read a file from the filesystem",
        action: "rewrite",
      },
      serviceName: "my-mcp-server",
      inputSchema: {
        type: "object" as const,
        properties: { path: { type: "string", description: "File path" } },
        required: ["path"],
      },
    },
    {
      name: "write_file",
      description: { text: "Write content to a file", action: "rewrite" },
      serviceName: "my-mcp-server",
      inputSchema: {
        type: "object" as const,
        properties: {
          path: { type: "string", description: "File path" },
          content: { type: "string", description: "Content to write" },
        },
        required: ["path", "content"],
      },
    },
    {
      name: "create_issue",
      description: { text: "Create a GitHub issue", action: "rewrite" },
      serviceName: "github-mcp",
    },
    {
      name: "custom-read",
      description: {
        text: "Custom read tool with overrides",
        action: "append",
      },
      serviceName: "my-mcp-server",
      originalToolName: "read_file",
      isCustom: true,
    },
  ];
}

export function createMockCustomTool(
  overrides: Partial<CustomTool> = {},
): CustomTool {
  return {
    name: "custom-read",
    description: { action: "append", text: "Only read .ts files" },
    originalTool: createMockServerTool(),
    overrideParams: {
      path: {
        value: "/src",
        description: { action: "rewrite", text: "Base directory" },
      },
    },
    ...overrides,
  };
}

// ── Access Controls ──────────────────────────────────────────────────────────

export function createMockToolGroups(): ToolGroup[] {
  return [
    {
      id: "tg-1",
      name: "File Operations",
      description: "Tools for file read/write operations",
      services: {
        "my-mcp-server": ["read_file", "write_file"],
      },
    },
    {
      id: "tg-2",
      name: "GitHub Tools",
      description: "GitHub integration tools",
      services: {
        "github-mcp": ["create_issue", "list_repos"],
      },
    },
  ];
}

export function createMockAgentProfiles(): AgentProfile[] {
  return [
    {
      id: "profile-default",
      name: "default",
      permission: "allow-all",
      agents: ["claude-desktop", "cursor", "windsurf"],
      toolGroups: [],
    },
    {
      id: "profile-restricted",
      name: "restricted",
      permission: "allow",
      agents: ["untrusted-agent"],
      toolGroups: ["tg-1"],
    },
  ];
}

// ── App Config ───────────────────────────────────────────────────────────────

export function createMockAppConfig(
  overrides: Partial<AppConfig> = {},
): AppConfig {
  return {
    permissions: {
      default: { _type: "default-allow", block: [] },
      consumers: {},
    },
    toolGroups: [
      {
        name: "File Operations",
        services: { "my-mcp-server": ["read_file", "write_file"] },
      },
      { name: "GitHub Tools", services: { "github-mcp": "*" } },
    ],
    auth: { enabled: false },
    toolExtensions: { services: {} },
    targetServerAttributes: {},
    ...overrides,
  };
}

// ── System State ─────────────────────────────────────────────────────────────

export function createMockSystemState(): SystemState {
  return {
    targetServers: [
      {
        _type: "stdio",
        name: "my-mcp-server",
        command: "npx",
        args: ["--port", "3000"],
        state: { type: "connected" },
        tools: [
          {
            name: "read_file",
            description: "Read a file",
            usage: { callCount: 42 },
            inputSchema: { type: "object" as const },
          },
          {
            name: "write_file",
            description: "Write a file",
            usage: { callCount: 15 },
            inputSchema: { type: "object" as const },
          },
        ],
        originalTools: [
          {
            name: "read_file",
            description: "Read a file",
            inputSchema: { type: "object" as const },
          },
          {
            name: "write_file",
            description: "Write a file",
            inputSchema: { type: "object" as const },
          },
        ],
        usage: { callCount: 57 },
      },
      {
        _type: "stdio",
        name: "github-mcp",
        command: "npx",
        state: { type: "connected" },
        tools: [
          {
            name: "create_issue",
            description: "Create a GitHub issue",
            usage: { callCount: 10 },
            inputSchema: { type: "object" as const },
          },
        ],
        originalTools: [
          {
            name: "create_issue",
            description: "Create a GitHub issue",
            inputSchema: { type: "object" as const },
          },
        ],
        usage: { callCount: 10 },
      },
    ],
    connectedClients: [
      {
        sessionId: "session-abc-123",
        clientId: "claude-desktop",
        usage: { callCount: 120 },
        consumerTag: "claude-desktop",
      },
    ],
    connectedClientClusters: [
      {
        name: "claude-desktop",
        sessionIds: ["session-abc-123"],
        usage: { callCount: 120 },
      },
    ],
    usage: { callCount: 200, lastCalledAt: new Date() },
    lastUpdatedAt: new Date(),
    mcpxVersion: "1.2.3",
  } as unknown as SystemState;
}
