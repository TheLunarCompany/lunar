import type { AppConfig, SystemState } from "@mcpx/shared-model";
import { socketStore } from "@/store/socket";
import { toolsStore } from "@/store/tools";

const date = (value: string): Date => new Date(value);

const mockSystemState: SystemState = {
  lastUpdatedAt: date("2026-05-11T13:14:24.250Z"),
  mcpxVersion: "1.0.0",
  usage: {
    callCount: 18,
    lastCalledAt: date("2026-05-11T13:13:11.000Z"),
  },
  targetServers: [
    {
      _type: "stdio",
      name: "github",
      catalogItemId: "0192f1c6-3a44-7c1d-aa10-d0b3f4d3e7b1",
      state: { type: "connected" },
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: {
        GITHUB_PERSONAL_ACCESS_TOKEN: {
          fromEnv: "MCPX_GITHUB_PAT_PREFILLED",
        },
      },
      icon: "https://example.com/github.svg",
      usage: {
        callCount: 12,
        lastCalledAt: date("2026-05-11T13:13:11.000Z"),
      },
      tools: [
        {
          name: "create_issue",
          description: "Create a new GitHub issue",
          inputSchema: {
            type: "object",
            properties: {
              owner: { type: "string" },
              repo: { type: "string" },
              title: { type: "string" },
              body: { type: "string" },
            },
            required: ["owner", "repo", "title"],
          },
          parameters: [
            { name: "owner", description: "Repository owner" },
            { name: "repo", description: "Repository name" },
            { name: "title", description: "Issue title" },
            { name: "body", description: "Issue body" },
          ],
          estimatedTokens: 142,
          annotations: { readOnlyHint: false, idempotentHint: false },
          usage: {
            callCount: 5,
            lastCalledAt: date("2026-05-11T13:11:30.000Z"),
          },
        },
        {
          name: "list_issues",
          description: "List issues in a repository",
          inputSchema: {
            type: "object",
            properties: {
              owner: { type: "string" },
              repo: { type: "string" },
            },
            required: ["owner", "repo"],
          },
          parameters: [
            { name: "owner", description: "Repository owner" },
            { name: "repo", description: "Repository name" },
          ],
          estimatedTokens: 91,
          usage: {
            callCount: 7,
            lastCalledAt: date("2026-05-11T13:13:11.000Z"),
          },
        },
      ],
      originalTools: [
        {
          name: "create_issue",
          description: "Create a new GitHub issue",
          inputSchema: {
            type: "object",
            properties: {
              owner: { type: "string" },
              repo: { type: "string" },
              title: { type: "string" },
              body: { type: "string" },
            },
            required: ["owner", "repo", "title"],
          },
        },
        {
          name: "list_issues",
          description: "List issues in a repository",
          inputSchema: {
            type: "object",
            properties: {
              owner: { type: "string" },
              repo: { type: "string" },
            },
            required: ["owner", "repo"],
          },
        },
        {
          name: "delete_repo",
          description: "Delete a repository",
          inputSchema: {
            type: "object",
            properties: {
              owner: { type: "string" },
              repo: { type: "string" },
            },
            required: ["owner", "repo"],
          },
        },
      ],
      prompts: [
        {
          name: "issue_template",
          description:
            "Template for opening a GitHub issue with the team's standard sections",
          arguments: [
            {
              name: "repo",
              description: "Target repository",
              required: true,
            },
            {
              name: "labels",
              description: "Comma-separated labels",
              required: false,
            },
          ],
          usage: {
            callCount: 2,
            lastCalledAt: date("2026-05-11T13:09:02.000Z"),
          },
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: "Create an issue in {repo} using the standard product engineering template. Apply these labels when provided: {labels}.",
              },
            },
            {
              role: "assistant",
              content: {
                type: "text",
                text: "I will draft the issue with Summary, Context, Acceptance Criteria, Risks, and Rollout Notes sections.",
              },
            },
            {
              role: "user",
              content: {
                type: "text",
                text: "Use a concise title, include clear reproduction steps when this is a bug, and call out any customer impact.",
              },
            },
            {
              role: "assistant",
              content: {
                type: "text",
                text: "I will keep the title action-oriented, add reproduction steps for bugs, and flag customer impact near the top of the issue body.",
              },
            },
          ],
        },
        {
          name: "internal_pr_template",
          description: "Internal template for pull request updates",
          arguments: [
            {
              name: "repo",
              description: "Target repository",
              required: true,
            },
            {
              name: "prNumber",
              description: "Pull request number",
              required: true,
            },
            {
              name: "reviewFocus",
              description: "Area reviewers should focus on",
              required: false,
            },
          ],
          usage: {
            callCount: 1,
            lastCalledAt: date("2026-05-11T13:08:14.000Z"),
          },
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: "Prepare an internal PR update for {repo}#{prNumber}. Focus reviewer attention on {reviewFocus} when provided.",
              },
            },
            {
              role: "assistant",
              content: {
                type: "text",
                text: "I will summarize the implementation, list the verification performed, and highlight any risky files or behavior changes.",
              },
            },
            {
              role: "user",
              content: {
                type: "text",
                text: "Include a short migration note if the change affects mock state, generated types, or persisted configuration.",
              },
            },
            {
              role: "assistant",
              content: {
                type: "text",
                text: "I will add a migration note only when the PR changes data shape, generated declarations, or saved user configuration.",
              },
            },
          ],
        },
      ],
      originalPrompts: [
        {
          name: "issue_template",
          description:
            "Template for opening a GitHub issue with the team's standard sections",
          arguments: [
            {
              name: "repo",
              description: "Target repository",
              required: true,
            },
            {
              name: "labels",
              description: "Comma-separated labels",
              required: false,
            },
          ],
        },
        {
          name: "internal_pr_template",
          description: "Internal template for pull request updates",
          arguments: [
            {
              name: "repo",
              description: "Target repository",
              required: true,
            },
            {
              name: "prNumber",
              description: "Pull request number",
              required: true,
            },
            {
              name: "reviewFocus",
              description: "Area reviewers should focus on",
              required: false,
            },
          ],
        },
      ],
    },
    {
      _type: "streamable-http",
      name: "linear",
      catalogItemId: "0192f1c6-9b22-7d52-89aa-b76c4d6e8ef1",
      state: { type: "pending-auth" },
      url: "https://mcp.linear.app/sse",
      headers: {},
      usage: { callCount: 0 },
      tools: [
        {
          name: "auth_linear",
          description: "Authenticate with Linear",
          inputSchema: { type: "object", properties: {} },
          parameters: [],
          usage: { callCount: 0 },
        },
        {
          name: "list_issues",
          description: "List Linear issues matching workspace filters",
          inputSchema: {
            type: "object",
            properties: {
              teamKey: {
                type: "string",
                description: "Linear team key, such as ENG or PLAT",
              },
              status: {
                type: "string",
                description: "Optional workflow status filter",
              },
              assignee: {
                type: "string",
                description: "Optional assignee username or email",
              },
            },
          },
          parameters: [
            { name: "teamKey", description: "Linear team key" },
            { name: "status", description: "Workflow status filter" },
            { name: "assignee", description: "Assignee username or email" },
          ],
          estimatedTokens: 118,
          annotations: { readOnlyHint: true },
          usage: { callCount: 0 },
        },
        {
          name: "create_issue",
          description: "Create a Linear issue in a team backlog",
          inputSchema: {
            type: "object",
            properties: {
              teamKey: {
                type: "string",
                description: "Linear team key, such as ENG or PLAT",
              },
              title: { type: "string", description: "Issue title" },
              description: {
                type: "string",
                description: "Issue description in Markdown",
              },
              priority: {
                type: "string",
                description: "Optional Linear priority",
              },
            },
            required: ["teamKey", "title"],
          },
          parameters: [
            { name: "teamKey", description: "Linear team key" },
            { name: "title", description: "Issue title" },
            { name: "description", description: "Issue description" },
            { name: "priority", description: "Issue priority" },
          ],
          estimatedTokens: 156,
          annotations: { readOnlyHint: false, idempotentHint: false },
          usage: { callCount: 0 },
        },
        {
          name: "update_issue_status",
          description: "Move a Linear issue to another workflow status",
          inputSchema: {
            type: "object",
            properties: {
              issueId: {
                type: "string",
                description: "Linear issue ID, such as ENG-123",
              },
              status: {
                type: "string",
                description: "Target workflow status",
              },
            },
            required: ["issueId", "status"],
          },
          parameters: [
            { name: "issueId", description: "Linear issue ID" },
            { name: "status", description: "Target workflow status" },
          ],
          estimatedTokens: 98,
          annotations: { readOnlyHint: false, idempotentHint: true },
          usage: { callCount: 0 },
        },
        {
          name: "list_projects",
          description: "List active Linear projects for a team",
          inputSchema: {
            type: "object",
            properties: {
              teamKey: {
                type: "string",
                description: "Optional Linear team key",
              },
            },
          },
          parameters: [{ name: "teamKey", description: "Linear team key" }],
          estimatedTokens: 82,
          annotations: { readOnlyHint: true },
          usage: { callCount: 0 },
        },
      ],
      originalTools: [
        {
          name: "auth_linear",
          description: "Authenticate with Linear",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "list_issues",
          description: "List Linear issues matching workspace filters",
          inputSchema: {
            type: "object",
            properties: {
              teamKey: {
                type: "string",
                description: "Linear team key, such as ENG or PLAT",
              },
              status: {
                type: "string",
                description: "Optional workflow status filter",
              },
              assignee: {
                type: "string",
                description: "Optional assignee username or email",
              },
            },
          },
          annotations: { readOnlyHint: true },
        },
        {
          name: "create_issue",
          description: "Create a Linear issue in a team backlog",
          inputSchema: {
            type: "object",
            properties: {
              teamKey: {
                type: "string",
                description: "Linear team key, such as ENG or PLAT",
              },
              title: { type: "string", description: "Issue title" },
              description: {
                type: "string",
                description: "Issue description in Markdown",
              },
              priority: {
                type: "string",
                description: "Optional Linear priority",
              },
            },
            required: ["teamKey", "title"],
          },
          annotations: { readOnlyHint: false, idempotentHint: false },
        },
        {
          name: "update_issue_status",
          description: "Move a Linear issue to another workflow status",
          inputSchema: {
            type: "object",
            properties: {
              issueId: {
                type: "string",
                description: "Linear issue ID, such as ENG-123",
              },
              status: {
                type: "string",
                description: "Target workflow status",
              },
            },
            required: ["issueId", "status"],
          },
          annotations: { readOnlyHint: false, idempotentHint: true },
        },
        {
          name: "list_projects",
          description: "List active Linear projects for a team",
          inputSchema: {
            type: "object",
            properties: {
              teamKey: {
                type: "string",
                description: "Optional Linear team key",
              },
            },
          },
          annotations: { readOnlyHint: true },
        },
      ],
      prompts: [
        {
          name: "issue_triage_summary",
          description:
            "Summarize open Linear issues by priority, owner, and blocked status",
          arguments: [
            {
              name: "teamKey",
              description: "Linear team key",
              required: true,
            },
            {
              name: "cycle",
              description: "Optional cycle name or number",
              required: false,
            },
          ],
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: "Summarize the current Linear triage queue for {{teamKey}}. Focus on urgent work, blocked issues, and items with unclear ownership.",
              },
            },
            {
              role: "assistant",
              content: {
                type: "text",
                text: "I will group the queue by priority, call out blockers, identify issues without owners, and end with recommended next actions.",
              },
            },
            {
              role: "user",
              content: {
                type: "text",
                text: "Include cycle context when {{cycle}} is provided, and keep the summary short enough for a standup handoff.",
              },
            },
          ],
          usage: { callCount: 0 },
        },
        {
          name: "sprint_planning_brief",
          description:
            "Draft a sprint planning brief from Linear project and issue context",
          arguments: [
            {
              name: "projectName",
              description: "Linear project name",
              required: true,
            },
            {
              name: "includeRisks",
              description: "Whether to include risk notes",
              required: false,
            },
          ],
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: "Prepare a sprint planning brief for the Linear project {{projectName}}. Include scope, proposed sequencing, and dependency risks.",
              },
            },
            {
              role: "assistant",
              content: {
                type: "text",
                text: "I will produce a planning brief with goals, candidate issues, sequencing notes, dependencies, and open questions for the team.",
              },
            },
            {
              role: "user",
              content: {
                type: "text",
                text: "If {{includeRisks}} is true, add a concise risk register with owner, likelihood, and mitigation for each risk.",
              },
            },
          ],
          usage: { callCount: 0 },
        },
      ],
      originalPrompts: [
        {
          name: "issue_triage_summary",
          description:
            "Summarize open Linear issues by priority, owner, and blocked status",
          arguments: [
            {
              name: "teamKey",
              description: "Linear team key",
              required: true,
            },
            {
              name: "cycle",
              description: "Optional cycle name or number",
              required: false,
            },
          ],
        },
        {
          name: "sprint_planning_brief",
          description:
            "Draft a sprint planning brief from Linear project and issue context",
          arguments: [
            {
              name: "projectName",
              description: "Linear project name",
              required: true,
            },
            {
              name: "includeRisks",
              description: "Whether to include risk notes",
              required: false,
            },
          ],
        },
      ],
    },
    {
      _type: "stdio",
      name: "calculator",
      catalogItemId: "0192f1c6-ca1c-7d52-89aa-b76c4d6e8ef1",
      state: {
        type: "pending-input",
        missingEnvVars: [
          { key: "PRECISION", type: "literal" },
          { key: "API_KEY", type: "fromEnv", fromEnvName: "ORG_CALC_KEY" },
        ],
      },
      command: "npx",
      args: ["-y", "@example/mcp-calculator"],
      usage: { callCount: 0 },
      tools: [
        {
          name: "evaluate",
          description: "Evaluate a deterministic calculation",
          inputSchema: { type: "object", properties: {} },
          parameters: [],
          usage: { callCount: 0 },
        },
      ],
      originalTools: [
        {
          name: "evaluate",
          description: "Evaluate a deterministic calculation",
          inputSchema: { type: "object", properties: {} },
        },
      ],
      prompts: [],
      originalPrompts: [],
    },
    {
      _type: "sse",
      name: "broken-server",
      catalogItemId: "0192f1c6-b20c-7d52-89aa-b76c4d6e8ef1",
      state: {
        type: "connection-failed",
        error: { name: "Error", message: "ECONNREFUSED 127.0.0.1:8080" },
      },
      url: "http://127.0.0.1:8080/sse",
      usage: { callCount: 0 },
      tools: [
        {
          name: "health_check",
          description: "Check whether the remote server is healthy",
          inputSchema: { type: "object", properties: {} },
          parameters: [],
          usage: { callCount: 0 },
        },
      ],
      originalTools: [
        {
          name: "health_check",
          description: "Check whether the remote server is healthy",
          inputSchema: { type: "object", properties: {} },
        },
      ],
      prompts: [],
      originalPrompts: [],
    },
    {
      _type: "streamable-http",
      name: "slack",
      catalogItemId: "0192f1c6-51ac-7d52-89aa-b76c4d6e8ef1",
      state: { type: "connected" },
      url: "https://mcp.slack.example.com/mcp",
      headers: {},
      usage: { callCount: 0 },
      tools: [
        {
          name: "post_message",
          description: "Post a message to a Slack channel",
          inputSchema: { type: "object", properties: {} },
          parameters: [],
          usage: { callCount: 0 },
        },
        {
          name: "search_messages",
          description: "Search recent Slack messages",
          inputSchema: { type: "object", properties: {} },
          parameters: [],
          usage: { callCount: 0 },
        },
      ],
      originalTools: [
        {
          name: "post_message",
          description: "Post a message to a Slack channel",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "search_messages",
          description: "Search recent Slack messages",
          inputSchema: { type: "object", properties: {} },
        },
      ],
      prompts: [],
      originalPrompts: [],
    },
  ],
  connectedClients: [
    {
      sessionId: "5e3c2b9a-7f5d-4d2c-9a3e-2b1d4f6a7c88",
      clientId: "c0ffee01-aaaa-bbbb-cccc-1234567890ab",
      usage: {
        callCount: 12,
        lastCalledAt: date("2026-05-11T13:13:11.000Z"),
      },
      consumerTag: "team-platform",
      llm: { provider: "anthropic", modelId: "claude-opus-4-7" },
      clientInfo: {
        name: "claude-code",
        version: "2.1.0",
        protocolVersion: "2025-11-25",
        adapter: {
          name: "mcp-remote",
          version: {
            major: 0,
            minor: 7,
            patch: 1,
            prerelease: [],
            build: [],
          },
          support: { ping: true },
        },
      },
    },
    {
      sessionId: "8a1f9d2e-2c3a-4b6f-91ed-d3e4f59a8b22",
      clientId: "c0ffee01-aaaa-bbbb-cccc-1234567890ab",
      usage: {
        callCount: 6,
        lastCalledAt: date("2026-05-11T13:12:30.000Z"),
      },
      consumerTag: "team-platform",
      llm: { provider: "anthropic", modelId: "claude-sonnet-4-6" },
      clientInfo: {
        name: "claude-code",
        version: "2.1.0",
        protocolVersion: "2025-11-25",
      },
    },
  ],
  connectedClientClusters: [
    {
      identityType: "consumerTag",
      consumerTag: "team-platform",
      clientNames: ["claude-code"],
      sessionIds: [
        "5e3c2b9a-7f5d-4d2c-9a3e-2b1d4f6a7c88",
        "8a1f9d2e-2c3a-4b6f-91ed-d3e4f59a8b22",
      ],
      usage: {
        callCount: 18,
        lastCalledAt: date("2026-05-11T13:13:11.000Z"),
      },
    },
  ],
};

const mockAppConfig: AppConfig = {
  permissions: {
    default: { _type: "default-allow", block: [] },
    consumers: {},
    clientNames: {},
  },
  toolGroups: [
    {
      name: "GitHub Triage",
      description: "Issue triage tools and prompts for GitHub workflows.",
      services: {
        github: [
          "create_issue",
          "list_issues",
          "issue_template",
          "internal_pr_template",
        ],
      },
    },
    {
      name: "Linear Workflows",
      description:
        "Planning and issue management tools and prompts for Linear workflows.",
      services: {
        linear: [
          "auth_linear",
          "list_issues",
          "create_issue",
          "update_issue_status",
          "issue_triage_summary",
          "sprint_planning_brief",
        ],
      },
    },
    {
      name: "GitHub Read Only",
      description: "Repository inspection and issue review capabilities.",
      services: {
        github: ["list_issues", "issue_template"],
      },
    },
    {
      name: "GitHub Authoring",
      description: "Issue creation and pull request communication helpers.",
      services: {
        github: ["create_issue", "internal_pr_template"],
      },
    },
    {
      name: "Linear Intake",
      description: "Authenticate, create, and summarize incoming Linear work.",
      services: {
        linear: ["auth_linear", "create_issue", "issue_triage_summary"],
      },
    },
    {
      name: "Linear Reporting",
      description: "Read project and issue status for planning updates.",
      services: {
        linear: ["list_issues", "list_projects", "issue_triage_summary"],
      },
    },
    {
      name: "Sprint Planning",
      description: "Cross-system planning context for sprint preparation.",
      services: {
        github: ["list_issues"],
        linear: ["list_projects", "sprint_planning_brief"],
        calculator: ["evaluate"],
        "broken-server": ["health_check"],
        slack: ["post_message"],
      },
    },
    {
      name: "Release Coordination",
      description: "PR update prompts and Linear status changes for releases.",
      services: {
        github: ["list_issues", "internal_pr_template"],
        linear: ["update_issue_status", "sprint_planning_brief"],
        calculator: ["evaluate"],
        "broken-server": ["health_check"],
        slack: ["post_message"],
      },
    },
    {
      name: "Incident Follow-up",
      description:
        "Create GitHub and Linear follow-up work from incident reviews.",
      services: {
        github: ["create_issue", "issue_template"],
        linear: ["create_issue", "update_issue_status"],
        calculator: ["evaluate"],
        "broken-server": ["health_check"],
        slack: ["search_messages"],
      },
    },
    {
      name: "All GitHub Capabilities",
      description: "Wildcard group covering every GitHub tool and prompt.",
      services: {
        github: "*",
      },
    },
  ],
  toolExtensions: { services: {} },
  targetServerAttributes: {},
  auth: { enabled: false },
};

export function seedToolsPageMockState(): void {
  window.__MCPX_TEST_MODE__ = true;

  socketStore.setState({
    appConfig: mockAppConfig,
    connectError: false,
    connectionRejectedHubRequired: false,
    isConnected: true,
    isPending: false,
    serializedAppConfig: {
      yaml: [
        "permissions:",
        "  default:",
        '    _type: "default-allow"',
        "    block: []",
        "  consumers: {}",
        "  clientNames: {}",
        "toolGroups:",
        '  - name: "GitHub Triage"',
        '    description: "Issue triage tools and prompts for GitHub workflows."',
        "    services:",
        "      github:",
        '        - "create_issue"',
        '        - "list_issues"',
        '        - "issue_template"',
        '        - "internal_pr_template"',
        '  - name: "Linear Workflows"',
        '    description: "Planning and issue management tools and prompts for Linear workflows."',
        "    services:",
        "      linear:",
        '        - "auth_linear"',
        '        - "list_issues"',
        '        - "create_issue"',
        '        - "update_issue_status"',
        '        - "issue_triage_summary"',
        '        - "sprint_planning_brief"',
        '  - name: "GitHub Read Only"',
        '    description: "Repository inspection and issue review capabilities."',
        "    services:",
        "      github:",
        '        - "list_issues"',
        '        - "issue_template"',
        '  - name: "GitHub Authoring"',
        '    description: "Issue creation and pull request communication helpers."',
        "    services:",
        "      github:",
        '        - "create_issue"',
        '        - "internal_pr_template"',
        '  - name: "Linear Intake"',
        '    description: "Authenticate, create, and summarize incoming Linear work."',
        "    services:",
        "      linear:",
        '        - "auth_linear"',
        '        - "create_issue"',
        '        - "issue_triage_summary"',
        '  - name: "Linear Reporting"',
        '    description: "Read project and issue status for planning updates."',
        "    services:",
        "      linear:",
        '        - "list_issues"',
        '        - "list_projects"',
        '        - "issue_triage_summary"',
        '  - name: "Sprint Planning"',
        '    description: "Cross-system planning context for sprint preparation."',
        "    services:",
        "      github:",
        '        - "list_issues"',
        "      linear:",
        '        - "list_projects"',
        '        - "sprint_planning_brief"',
        "      calculator:",
        '        - "evaluate"',
        "      broken-server:",
        '        - "health_check"',
        "      slack:",
        '        - "post_message"',
        '  - name: "Release Coordination"',
        '    description: "PR update prompts and Linear status changes for releases."',
        "    services:",
        "      github:",
        '        - "list_issues"',
        '        - "internal_pr_template"',
        "      linear:",
        '        - "update_issue_status"',
        '        - "sprint_planning_brief"',
        "      calculator:",
        '        - "evaluate"',
        "      broken-server:",
        '        - "health_check"',
        "      slack:",
        '        - "post_message"',
        '  - name: "Incident Follow-up"',
        '    description: "Create GitHub and Linear follow-up work from incident reviews."',
        "    services:",
        "      github:",
        '        - "create_issue"',
        '        - "issue_template"',
        "      linear:",
        '        - "create_issue"',
        '        - "update_issue_status"',
        "      calculator:",
        '        - "evaluate"',
        "      broken-server:",
        '        - "health_check"',
        "      slack:",
        '        - "search_messages"',
        '  - name: "All GitHub Capabilities"',
        '    description: "Wildcard group covering every GitHub tool and prompt."',
        "    services:",
        '      github: "*"',
        "toolExtensions:",
        "  services: {}",
        "targetServerAttributes: {}",
      ].join("\n"),
      version: 1,
      lastModified: new Date(),
    },
    socket: null,
    systemState: mockSystemState,
  });

  toolsStore.getState().init(socketStore.getState());
}
