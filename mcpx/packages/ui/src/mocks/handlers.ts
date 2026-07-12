import { http, HttpResponse } from "msw";
import type {
  CatalogMCPServerItem,
  CatalogMCPServerList,
  Skill,
  SkillDraft,
} from "@mcpx/shared-model";
import { skillSchema } from "@mcpx/shared-model";

type ApprovedCapabilityType = "tool" | "prompt";

type ApprovedCapabilities = {
  catalogItemId: string;
  approvedTools: string[];
  approvedPrompts: string[];
};

type PutApprovedCapabilitiesRequest = Partial<
  Record<ApprovedCapabilityType, string[]>
>;

type AddApprovedCapabilitiesRequest = {
  type: ApprovedCapabilityType;
  name: string;
};

type SandboxAnalysisCapability = {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
};

type SandboxAnalysisResponse = {
  id: string;
  catalogItemId: string;
  jobId: string;
  createdAt: string;
  tools: SandboxAnalysisCapability[];
  prompts: SandboxAnalysisCapability[];
};

type EnrichedCatalogItem = {
  id: string;
  name: string;
  displayName: string | null;
  description: string | null;
  config: CatalogMCPServerList[number]["config"];
  repoUrl: string | null;
  docsUrl: string | null;
  latestReviewDecision: "APPROVED" | "REJECTED" | "PENDING" | null;
  createdAt: string;
  updatedAt: string;
  originSpaceId: string | null;
  approvedTools: Array<{ toolName: string }>;
  approvedPrompts: Array<{ promptName: string }>;
};

// These IDs intentionally match the seeded mock `systemState.targetServers`
// (see mocks/tools-page/seed-state.ts) so the Skills cards' "MCP Servers"
// badges resolve to real, connected server names in local mock mode.
const GITHUB_CATALOG_ITEM_ID = "0192f1c6-3a44-7c1d-aa10-d0b3f4d3e7b1";
const LINEAR_CATALOG_ITEM_ID = "0192f1c6-9b22-7d52-89aa-b76c4d6e8ef1";
const SLACK_CATALOG_ITEM_ID = "0192f1c6-51ac-7d52-89aa-b76c4d6e8ef1";
const CALCULATOR_CATALOG_ITEM_ID = "0192f1c6-ca1c-7d52-89aa-b76c4d6e8ef1";
const BROKEN_SERVER_CATALOG_ITEM_ID = "0192f1c6-b20c-7d52-89aa-b76c4d6e8ef1";
const FILESYSTEM_CATALOG_ITEM_ID = "0190a000-0000-7000-8000-000000000014";
const CONTEXT7_CATALOG_ITEM_ID = "018f6f21-7117-70f2-beba-20a9339c4222";
// Servers with no seeded target server: these badges won't resolve in mock mode
// without catalog fallback data.
const PLAYWRIGHT_CATALOG_ITEM_ID = "018f6f21-668f-7357-b1e5-7b3ba814d195";
const GOOGLE_DRIVE_CATALOG_ITEM_ID = "0190a000-0000-7000-8000-000000000011";
const STDIO_MCP_SERVERS_NOT_ALLOWED_RESPONSE = {
  message:
    "This organization does not allow STDIO MCP servers. Contact your administrator for access.",
  error: {
    errorName: "NotAllowedError",
    errorMessage:
      "This organization does not allow STDIO MCP servers. Contact your administrator for access.",
  },
};

const FULL_STACK_DEBUGGING_SKILL_BODY = [
  "# Full stack debugging copilot",
  "",
  "Use this skill when a product issue needs to be traced across browser behavior, API calls, background jobs, storage, and team communication. The goal is to produce a clear diagnosis that another engineer can validate without repeating the whole investigation.",
  "",
  "## Operating principles",
  "",
  "- Start from the user-visible symptom and preserve the exact reproduction path.",
  "- Keep every claim tied to evidence from a tool result, log line, issue, or file.",
  "- Prefer the smallest confirmed root cause over a broad theory.",
  "- Separate confirmed facts from hypotheses and next checks.",
  "- Stop before making risky changes unless the owner explicitly asks for a fix.",
  "",
  "## Investigation flow",
  "",
  "1. Restate the symptom in one sentence, including environment, user role, and time window.",
  "2. Check whether the issue is reproducible in the browser or only visible in logs.",
  "3. Inspect the related repository code path and identify the likely entry point.",
  "4. Search issue trackers for matching incidents, regressions, or recent work.",
  "5. Pull Slack context when the symptom appears tied to an active incident or rollout.",
  "6. Use calculations only for concrete comparisons, such as error rates or latency deltas.",
  "7. Summarize the finding as evidence, impact, likely cause, and next action.",
  "",
  "## Browser checks",
  "",
  "- Capture the current URL, route params, and visible error state.",
  "- Note console errors and network failures separately.",
  "- If a request fails, record method, route, status, and correlation IDs.",
  "- Compare expected UI state with actual UI state before inspecting code.",
  "",
  "## Repository checks",
  "",
  "- Search for route names, API paths, feature flags, and error strings.",
  "- Read the smallest connected files first: route, mapping, service, and test.",
  "- Identify ownership boundaries before proposing a fix.",
  "- Look for recently changed validation, filtering, permission, or serialization logic.",
  "",
  "## Issue tracker checks",
  "",
  "- Link related Linear issues by title and status.",
  "- Call out duplicate reports and the earliest known occurrence.",
  "- If no issue exists, draft a concise issue with reproduction steps and evidence.",
  "",
  "## Communication checks",
  "",
  "- Search Slack for the feature name, error text, and recent deploy references.",
  "- Summarize only the messages that change the diagnosis.",
  "- Use a short handoff format when posting updates back to the incident channel.",
  "",
  "## Output format",
  "",
  "```md",
  "## Finding",
  "<one sentence diagnosis or strongest hypothesis>",
  "",
  "## Evidence",
  "- <tool/log/code evidence>",
  "- <issue or Slack evidence>",
  "",
  "## Impact",
  "<affected users, workflows, or data>",
  "",
  "## Next action",
  "<one concrete next step>",
  "```",
  "",
  "## Quality bar",
  "",
  "A good answer should make the next engineer faster. If the diagnosis is not proven, say so directly and list the one or two checks that would prove or disprove it.",
].join("\n");

export function parseMockSkills(records: unknown[]): Skill[] {
  return records.flatMap((record) => {
    const result = skillSchema.safeParse(record);
    if (!result.success) {
      console.warn("Invalid mock skill skipped", result.error);
      return [];
    }

    return [result.data];
  });
}

const initialPersonalSkills: Skill[] = parseMockSkills([
  {
    id: "0190a000-0000-7000-8000-000000000001",
    name: "review-pull-requests",
    description: "Review repository changes with local project rules.",
    body: "# Review pull requests\n\nCheck tests, risks, and regressions.",
    exposeAsPrompt: true,
    author: {
      setupOwnerId: "mock-user",
      displayName: "Mock User",
    },
    updatedAt: new Date("2026-06-29T10:00:00.000Z"),
    capabilityGroup: {
      name: "Repository",
      items: [
        {
          catalogItemId: GITHUB_CATALOG_ITEM_ID,
          tools: ["pull_request_read"],
          prompts: ["internal_pr_template"],
        },
        {
          catalogItemId: LINEAR_CATALOG_ITEM_ID,
          tools: ["list_issues"],
          prompts: ["issue_triage_summary"],
        },
      ],
    },
  },
  // Edge case: very long single-token name (no spaces) — tests truncation.
  {
    id: "0190a000-0000-7000-8000-000000000002",
    name: "automated-e2e-regression-suite-orchestration-flaky-quarantine",
    description:
      "Run the full browser regression suite, retry flaky specs, and quarantine persistently failing tests.",
    body: "# E2E regression\n\nOrchestrate Playwright runs and quarantine flaky specs.",
    exposeAsPrompt: true,
    author: {
      setupOwnerId: "mock-user",
      displayName: "Mock User",
    },
    updatedAt: new Date("2026-06-28T14:30:00.000Z"),
    capabilityGroup: {
      name: "Browser & CI",
      items: [
        {
          catalogItemId: PLAYWRIGHT_CATALOG_ITEM_ID,
          tools: "*",
          prompts: ["browser_regression_plan"],
        },
        {
          catalogItemId: GITHUB_CATALOG_ITEM_ID,
          tools: ["actions_read", "checks_read", "workflow_dispatch"],
          prompts: ["internal_pr_template"],
        },
        {
          catalogItemId: SLACK_CATALOG_ITEM_ID,
          tools: ["post_message"],
          prompts: ["incident_channel_update"],
        },
        {
          catalogItemId: CALCULATOR_CATALOG_ITEM_ID,
          tools: ["evaluate"],
          prompts: ["calculation_summary"],
        },
      ],
    },
  },
  // Edge case: very long description — tests 2-line clamp.
  {
    id: "0190a000-0000-7000-8000-000000000003",
    name: "incident-response",
    description:
      "Coordinate the full incident lifecycle from the first alert to the postmortem: page the on-call rotation, open a dedicated war-room channel, pull the relevant dashboards and recent deploys, draft customer-facing status updates, track remediation action items, and assemble a blameless retrospective with a timeline once the incident is resolved.",
    body: "# Incident response\n\nDeclare, mitigate, communicate, resolve, and review.",
    exposeAsPrompt: true,
    author: {
      setupOwnerId: "mock-user",
      displayName: "Mock User",
    },
    updatedAt: new Date("2026-06-30T09:15:00.000Z"),
  },
  // Edge case: exposeAsPrompt = false (renders the "Resource only" pill) + no tool group.
  {
    id: "0190a000-0000-7000-8000-000000000004",
    name: "brand-voice-guidelines",
    description:
      "Reference for tone, terminology, and formatting when drafting external copy.",
    body: "# Brand voice\n\nWrite in second person, active voice, no jargon.",
    exposeAsPrompt: false,
    author: {
      setupOwnerId: "mock-user",
      displayName: "Mock User",
    },
    updatedAt: new Date("2026-05-12T08:00:00.000Z"),
  },
  // Edge case: very long author displayName + long-ish title.
  {
    id: "0190a000-0000-7000-8000-000000000005",
    name: "quarterly-board-deck-assembler",
    description:
      "Compile metrics, narrative, and appendix slides into the standard board template.",
    body: "# Board deck\n\nPull KPIs and assemble the standard template.",
    exposeAsPrompt: true,
    author: {
      setupOwnerId: "mock-user-long",
      displayName:
        "Alexandra Constantinescu-Featherstonehaugh (Revenue Operations)",
    },
    updatedAt: new Date("2026-06-21T17:45:00.000Z"),
    capabilityGroup: {
      name: "Docs",
      items: [
        {
          catalogItemId: GOOGLE_DRIVE_CATALOG_ITEM_ID,
          tools: ["create", "read"],
          prompts: ["docs_summary"],
        },
      ],
    },
  },
  // Edge case: emoji / unicode in the name.
  {
    id: "0190a000-0000-7000-8000-000000000006",
    name: "release-notes-generator",
    description:
      "Summarize merged PRs since the last tag into grouped, human-readable release notes.",
    body: "# Release notes\n\nGroup merged PRs by type and summarize.",
    exposeAsPrompt: true,
    author: {
      setupOwnerId: "mock-user",
      displayName: "Mock User",
    },
    updatedAt: new Date("2026-06-15T11:20:00.000Z"),
    capabilityGroup: {
      name: "Repository",
      items: [
        {
          catalogItemId: GITHUB_CATALOG_ITEM_ID,
          tools: ["releases_write"],
          prompts: ["internal_pr_template"],
        },
      ],
    },
  },
  // Edge case: minimal skill — short everything, no tool group.
  {
    id: "0190a000-0000-7000-8000-000000000007",
    name: "echo",
    description: "Repeat the input back.",
    body: "# Echo\n\nReturn the input unchanged.",
    exposeAsPrompt: true,
    author: {
      setupOwnerId: "mock-user",
      displayName: "QA",
    },
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
  },
  // Edge case: large tool group spanning many catalog items.
  {
    id: "0190a000-0000-7000-8000-000000000008",
    name: "full-stack-debugging-copilot",
    description:
      "Trace an issue across the browser, API, database, and logs in one pass.",
    body: FULL_STACK_DEBUGGING_SKILL_BODY,
    exposeAsPrompt: true,
    author: {
      setupOwnerId: "mock-user",
      displayName: "Platform Team",
    },
    updatedAt: new Date("2026-06-27T13:05:00.000Z"),
    capabilityGroup: {
      name: "Full stack",
      items: [
        {
          catalogItemId: GITHUB_CATALOG_ITEM_ID,
          tools: [
            "code_search",
            "pull_request_read",
            "actions_read",
            "checks_read",
            "workflow_dispatch",
            "releases_write",
            "create_issue",
            "list_issues",
            "compare_branches",
            "review_threads_read",
          ],
          prompts: [
            "internal_pr_template",
            "issue_template",
            "release_note_draft",
            "regression_risk_checklist",
            "review_summary",
            "ci_failure_brief",
            "backport_plan",
            "dependency_upgrade_notes",
            "security_review_prompt",
            "rollout_plan",
          ],
        },
        {
          catalogItemId: LINEAR_CATALOG_ITEM_ID,
          tools: ["list_issues", "update_issue_status"],
          prompts: ["issue_triage_summary", "sprint_planning_brief"],
        },
        {
          catalogItemId: SLACK_CATALOG_ITEM_ID,
          tools: ["search_messages", "post_message"],
          prompts: ["incident_channel_update", "standup_handoff"],
        },
        {
          catalogItemId: CALCULATOR_CATALOG_ITEM_ID,
          tools: ["evaluate"],
          prompts: ["calculation_summary"],
        },
        {
          catalogItemId: BROKEN_SERVER_CATALOG_ITEM_ID,
          tools: ["health_check"],
          prompts: ["diagnostic_summary"],
        },
        {
          catalogItemId: FILESYSTEM_CATALOG_ITEM_ID,
          tools: ["read_file", "write_file"],
          prompts: ["workspace_file_brief", "changed_files_summary"],
        },
        { catalogItemId: FILESYSTEM_CATALOG_ITEM_ID, tools: "*", prompts: [] },
        {
          catalogItemId: CONTEXT7_CATALOG_ITEM_ID,
          tools: ["get-library-docs"],
          prompts: [],
        },
      ],
    },
  },
  // Edge case: extremely long description — stress-tests the 2-line clamp.
  {
    id: "0190a000-0000-7000-8000-000000000009",
    name: "codebase-onboarding-tour",
    description:
      "Generate a guided, top-to-bottom tour of an unfamiliar repository for a brand-new engineer: start from the entry points and build and run scripts, map the high-level module boundaries and how a request flows from the edge through the service layer down to the data stores, call out the project's conventions for testing, error handling, configuration, and logging, surface the handful of files that change most often alongside the ones that are load-bearing but rarely touched, list the environment variables and external services required to run everything locally, link each area to the most relevant documentation and code owners, and finish with a short, ordered set of starter tasks that progressively build familiarity without touching critical paths on the very first day.",
    body: "# Onboarding tour\n\nWalk a new engineer through the repository in order.",
    exposeAsPrompt: true,
    author: {
      setupOwnerId: "mock-user",
      displayName: "Platform Team",
    },
    updatedAt: new Date("2026-06-26T10:30:00.000Z"),
  },
]);

let personalSkills = structuredClone(initialPersonalSkills);
let nextSkillId = 10;

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

const initialApprovedCapabilities: Record<
  string,
  Record<ApprovedCapabilityType, string[]>
> = {
  "018f6f21-5f3e-7b40-a84d-c276df5b9d91": {
    tool: ["channels.list", "chat.postMessage"],
    prompt: ["summarize-thread"],
  },
  "018f6f21-668f-7357-b1e5-7b3ba814d195": {
    tool: ["browser_console_messages", "browser_take_screenshot"],
    prompt: [],
  },
  "018f6f21-7117-70f2-beba-20a9339c4222": {
    tool: ["resolve-library-id", "get-library-docs"],
    prompt: ["explain-library-upgrade"],
  },
};

let orgApprovedCapabilities = structuredClone(initialApprovedCapabilities);
let curatedApprovedCapabilities = structuredClone(initialApprovedCapabilities);

const sandboxAnalyses: SandboxAnalysisResponse[] = [
  {
    id: "10000000-0000-4000-a000-000000000001",
    catalogItemId: "018f6f21-5f3e-7b40-a84d-c276df5b9d91",
    jobId: "job-slack-analysis",
    createdAt: "2026-05-11T08:00:00.000Z",
    tools: [
      {
        name: "channels.list",
        description: "List Slack channels in the workspace.",
        arguments: [
          {
            name: "limit",
            description: "Maximum channels to return.",
            required: false,
          },
        ],
      },
      {
        name: "chat.postMessage",
        description: "Post a message to a Slack channel.",
        arguments: [
          {
            name: "channel",
            description: "The Slack channel ID.",
            required: true,
          },
          {
            name: "text",
            description: "The message text.",
            required: true,
          },
        ],
      },
    ],
    prompts: [
      {
        name: "summarize-thread",
        description: "Summarize a Slack thread for handoff.",
        arguments: [
          {
            name: "channelId",
            description: "The Slack channel that contains the thread.",
            required: true,
          },
          {
            name: "threadTs",
            description: "The timestamp of the parent thread message.",
            required: true,
          },
        ],
      },
    ],
  },
  {
    id: "10000000-0000-4000-a000-000000000002",
    catalogItemId: "018f6f21-7117-70f2-beba-20a9339c4222",
    jobId: "job-context7-analysis",
    createdAt: "2026-05-11T08:05:00.000Z",
    tools: [
      {
        name: "resolve-library-id",
        description: "Resolve a package name to a Context7 library ID.",
      },
      {
        name: "get-library-docs",
        description: "Fetch documentation for a Context7 library.",
      },
    ],
    prompts: [
      {
        name: "explain-library-upgrade",
        description: "Explain relevant upgrade notes from current docs.",
        arguments: [
          {
            name: "libraryId",
            description: "The Context7 library ID.",
            required: true,
          },
        ],
      },
    ],
  },
];

const catalogServersById = new Map(
  catalogMcpServers.map((server) => [server.id, server]),
);

function createMockTargetServer(server: CatalogMCPServerItem) {
  const usage = { callCount: 0 };

  if (server.config.type === "stdio") {
    return {
      _type: "stdio",
      state: { type: "connecting" },
      name: server.name,
      catalogItemId: server.id,
      command: server.config.command,
      args: server.config.args,
      env: {},
      icon: server.config.icon,
      tools: [],
      originalTools: [],
      prompts: [],
      originalPrompts: [],
      usage,
    };
  }

  return {
    _type: server.config.type,
    state: { type: "connecting" },
    name: server.name,
    catalogItemId: server.id,
    url: server.config.url,
    headers: server.config.headers,
    icon: server.config.icon,
    tools: [],
    originalTools: [],
    prompts: [],
    originalPrompts: [],
    usage,
  };
}

function getApprovedCapabilities(
  catalogItemId: string,
  source: Record<string, Record<ApprovedCapabilityType, string[]>>,
): ApprovedCapabilities {
  const capabilities = source[catalogItemId] ?? {
    tool: [],
    prompt: [],
  };

  return {
    catalogItemId,
    approvedTools: [...capabilities.tool],
    approvedPrompts: [...capabilities.prompt],
  };
}

function updateApprovedCapabilities(
  catalogItemId: string,
  payload: PutApprovedCapabilitiesRequest,
  source: Record<string, Record<ApprovedCapabilityType, string[]>>,
): ApprovedCapabilities {
  const capabilities = (source[catalogItemId] ??= {
    tool: [],
    prompt: [],
  });

  if (payload.tool !== undefined) {
    capabilities.tool = [...payload.tool];
  }

  if (payload.prompt !== undefined) {
    capabilities.prompt = [...payload.prompt];
  }

  return getApprovedCapabilities(catalogItemId, source);
}

function addApprovedCapability(
  catalogItemId: string,
  payload: AddApprovedCapabilitiesRequest,
): ApprovedCapabilities {
  const capabilities = (orgApprovedCapabilities[catalogItemId] ??= {
    tool: [],
    prompt: [],
  });

  if (!capabilities[payload.type].includes(payload.name)) {
    capabilities[payload.type].push(payload.name);
  }

  return getApprovedCapabilities(catalogItemId, orgApprovedCapabilities);
}

function deleteApprovedCapability(
  catalogItemId: string,
  type: ApprovedCapabilityType,
  name: string,
): ApprovedCapabilities {
  const capabilities = (orgApprovedCapabilities[catalogItemId] ??= {
    tool: [],
    prompt: [],
  });

  capabilities[type] = capabilities[type].filter((item) => item !== name);

  return getApprovedCapabilities(catalogItemId, orgApprovedCapabilities);
}

function getEnrichedCatalogItems(): EnrichedCatalogItem[] {
  return Object.entries(curatedApprovedCapabilities).map(
    ([catalogItemId, capabilities]) => {
      const server = catalogServersById.get(catalogItemId);

      return {
        id: catalogItemId,
        name: server?.name ?? catalogItemId,
        displayName: server?.displayName ?? null,
        description: server?.description ?? null,
        config: server?.config ?? {
          type: "stdio",
          command: "npx",
          args: [],
          env: {},
        },
        repoUrl: server?.link ?? null,
        docsUrl: null,
        latestReviewDecision: "APPROVED",
        createdAt: "2026-05-11T08:00:00.000Z",
        updatedAt: "2026-05-11T08:00:00.000Z",
        originSpaceId: null,
        approvedTools: capabilities.tool.map((toolName) => ({ toolName })),
        approvedPrompts: capabilities.prompt.map((promptName) => ({
          promptName,
        })),
      };
    },
  );
}

function getUnapprovedCapabilities(
  catalogItemId: string,
  payload: PutApprovedCapabilitiesRequest,
): Array<{ type: ApprovedCapabilityType; name: string }> {
  const orgApproved = orgApprovedCapabilities[catalogItemId] ?? {
    tool: [],
    prompt: [],
  };
  const invalid: Array<{ type: ApprovedCapabilityType; name: string }> = [];

  for (const type of ["tool", "prompt"] as const) {
    const requested = payload[type];
    if (!requested) continue;

    const allowed = new Set(orgApproved[type]);
    for (const name of requested) {
      if (!allowed.has(name)) {
        invalid.push({ type, name });
      }
    }
  }

  return invalid;
}

function validateCuratedApprovedCapabilities(
  catalogItemId: string,
  payload: PutApprovedCapabilitiesRequest,
): ReturnType<typeof HttpResponse.json> | null {
  const invalid = getUnapprovedCapabilities(catalogItemId, payload);
  if (invalid.length === 0) {
    return null;
  }

  return HttpResponse.json(
    {
      message: "The following capabilities are not approved at catalog level",
      invalid,
    },
    { status: 422 },
  );
}

function isApprovedCapabilityType(
  value: string | readonly string[] | undefined,
): value is ApprovedCapabilityType {
  return value === "tool" || value === "prompt";
}

export function resetMockApiState(): void {
  orgApprovedCapabilities = structuredClone(initialApprovedCapabilities);
  curatedApprovedCapabilities = structuredClone(initialApprovedCapabilities);
  personalSkills = structuredClone(initialPersonalSkills);
  nextSkillId = 10;
}

export const handlers = [
  http.get("*/skills", () => {
    return HttpResponse.json({ skills: personalSkills });
  }),

  http.get("*/skills/:id", ({ params }) => {
    const skill = personalSkills.find((item) => item.id === String(params.id));

    if (!skill) {
      return HttpResponse.json({ message: "Skill not found" }, { status: 404 });
    }

    return HttpResponse.json(skill);
  }),

  http.post("*/skills", async ({ request }) => {
    const draft = (await request.json()) as SkillDraft;
    const skill: Skill = {
      ...draft,
      id: `0190a000-0000-7000-8000-${String(nextSkillId).padStart(12, "0")}`,
      author: {
        setupOwnerId: "mock-user",
        displayName: "Mock User",
      },
      updatedAt: new Date("2026-06-29T11:00:00.000Z"),
    };

    nextSkillId += 1;
    personalSkills = [...personalSkills, skill];

    return HttpResponse.json(skill, { status: 201 });
  }),

  http.put("*/skills/:id/details", async ({ params, request }) => {
    const id = String(params.id);
    const existingSkill = personalSkills.find((skill) => skill.id === id);

    if (!existingSkill) {
      return HttpResponse.json({ message: "Skill not found" }, { status: 404 });
    }

    const draft = (await request.json()) as SkillDraft;
    const skill: Skill = {
      ...existingSkill,
      ...draft,
      ...(existingSkill.capabilityGroup
        ? { capabilityGroup: existingSkill.capabilityGroup }
        : {}),
      id,
      updatedAt: new Date("2026-06-29T11:30:00.000Z"),
    };

    personalSkills = personalSkills.map((item) =>
      item.id === id ? skill : item,
    );

    return HttpResponse.json(skill);
  }),

  http.put("*/skills/:id", async ({ params, request }) => {
    const id = String(params.id);
    const existingSkill = personalSkills.find((skill) => skill.id === id);

    if (!existingSkill) {
      return HttpResponse.json({ message: "Skill not found" }, { status: 404 });
    }

    const draft = (await request.json()) as SkillDraft;
    const skill: Skill = {
      ...existingSkill,
      ...draft,
      id,
      updatedAt: new Date("2026-06-29T11:30:00.000Z"),
    };

    personalSkills = personalSkills.map((item) =>
      item.id === id ? skill : item,
    );

    return HttpResponse.json(skill);
  }),

  http.put("*/skills/:id/capabilities", async ({ params, request }) => {
    const id = String(params.id);
    const existingSkill = personalSkills.find((skill) => skill.id === id);

    if (!existingSkill) {
      return HttpResponse.json({ message: "Skill not found" }, { status: 404 });
    }

    const body = (await request.json()) as {
      capabilityGroup?: Skill["capabilityGroup"] | null;
    };
    const { capabilityGroup: _previous, ...skillDetails } = existingSkill;
    const nextCapabilityGroup = body.capabilityGroup;
    const skill: Skill = {
      ...skillDetails,
      ...(nextCapabilityGroup === undefined
        ? { capabilityGroup: existingSkill.capabilityGroup }
        : nextCapabilityGroup?.items.length
          ? { capabilityGroup: { items: nextCapabilityGroup.items } }
          : {}),
      id,
      updatedAt: new Date("2026-06-29T11:30:00.000Z"),
    };

    personalSkills = personalSkills.map((item) =>
      item.id === id ? skill : item,
    );

    return HttpResponse.json(skill);
  }),

  http.delete("*/skills/:id", ({ params }) => {
    const id = String(params.id);
    const existingSkill = personalSkills.find((skill) => skill.id === id);

    if (!existingSkill) {
      return HttpResponse.json({ message: "Skill not found" }, { status: 404 });
    }

    personalSkills = personalSkills.filter((skill) => skill.id !== id);

    return new HttpResponse(null, { status: 204 });
  }),

  http.get("*/catalog/mcp-servers", () => {
    return HttpResponse.json(catalogMcpServers);
  }),

  http.post("*/catalog-item/:id/target-server", ({ params }) => {
    const catalogItemId = String(params.id);

    if (catalogItemId === PLAYWRIGHT_CATALOG_ITEM_ID) {
      return HttpResponse.json(STDIO_MCP_SERVERS_NOT_ALLOWED_RESPONSE, {
        status: 403,
      });
    }

    const server = catalogServersById.get(catalogItemId);
    if (!server) {
      return HttpResponse.json(
        { message: `Catalog item not found: ${catalogItemId}` },
        { status: 404 },
      );
    }

    return HttpResponse.json(createMockTargetServer(server));
  }),

  http.get("*/catalog-items/:id/approved-capabilities", ({ params }) => {
    return HttpResponse.json(
      getApprovedCapabilities(String(params.id), orgApprovedCapabilities),
    );
  }),

  http.put(
    "*/catalog-items/:id/approved-capabilities",
    async ({ params, request }) => {
      const payload = (await request.json()) as PutApprovedCapabilitiesRequest;

      return HttpResponse.json(
        updateApprovedCapabilities(
          String(params.id),
          payload,
          orgApprovedCapabilities,
        ),
      );
    },
  ),

  http.post(
    "*/catalog-items/:id/approved-capabilities",
    async ({ params, request }) => {
      const payload = (await request.json()) as AddApprovedCapabilitiesRequest;

      return HttpResponse.json(
        addApprovedCapability(String(params.id), payload),
      );
    },
  ),

  http.delete(
    "*/catalog-items/:id/approved-capabilities/:type/:name",
    ({ params }) => {
      const type = params.type;
      const name = String(params.name);

      if (!isApprovedCapabilityType(type)) {
        return HttpResponse.json(
          { message: `Unknown capability type: ${String(type)}` },
          { status: 400 },
        );
      }

      return HttpResponse.json(
        deleteApprovedCapability(String(params.id), type, name),
      );
    },
  ),

  http.get(
    "*/sub-catalogs/:id/items/:catalogItemId/approved-capabilities",
    ({ params }) => {
      return HttpResponse.json(
        getApprovedCapabilities(
          String(params.catalogItemId),
          curatedApprovedCapabilities,
        ),
      );
    },
  ),

  http.put(
    "*/sub-catalogs/:id/items/:catalogItemId/approved-capabilities",
    async ({ params, request }) => {
      const payload = (await request.json()) as PutApprovedCapabilitiesRequest;
      const validationError = validateCuratedApprovedCapabilities(
        String(params.catalogItemId),
        payload,
      );
      if (validationError) return validationError;

      return HttpResponse.json(
        updateApprovedCapabilities(
          String(params.catalogItemId),
          payload,
          curatedApprovedCapabilities,
        ),
      );
    },
  ),

  http.get(
    "*/default-catalog/items/:catalogItemId/approved-capabilities",
    ({ params }) => {
      return HttpResponse.json(
        getApprovedCapabilities(
          String(params.catalogItemId),
          curatedApprovedCapabilities,
        ),
      );
    },
  ),

  http.put(
    "*/default-catalog/items/:catalogItemId/approved-capabilities",
    async ({ params, request }) => {
      const payload = (await request.json()) as PutApprovedCapabilitiesRequest;
      const validationError = validateCuratedApprovedCapabilities(
        String(params.catalogItemId),
        payload,
      );
      if (validationError) return validationError;

      return HttpResponse.json(
        updateApprovedCapabilities(
          String(params.catalogItemId),
          payload,
          curatedApprovedCapabilities,
        ),
      );
    },
  ),

  http.get("*/sandbox-analysis", () => {
    return HttpResponse.json({ analyses: sandboxAnalyses });
  }),

  http.get("*/sandbox-analysis/:id", ({ params }) => {
    const analysis = sandboxAnalyses.find(
      (item) => item.id === String(params.id),
    );

    if (!analysis) {
      return HttpResponse.json(
        { message: `Sandbox analysis not found: ${String(params.id)}` },
        { status: 404 },
      );
    }

    return HttpResponse.json(analysis);
  }),

  http.get("*/sub-catalogs/:id/items", () => {
    return HttpResponse.json({ items: getEnrichedCatalogItems() });
  }),

  http.get("*/default-catalog/items", () => {
    return HttpResponse.json({ items: getEnrichedCatalogItems() });
  }),

  // Custom target server writes. Keep after catalog handlers so
  // `*/catalog-item/:id/target-server` wins over the `*/target-server` wildcard.
  http.post("*/target-server", async ({ request }) => {
    const payload = (await request.json()) as { name: string };
    return HttpResponse.json(
      { name: payload.name, state: { type: "connecting" } },
      { status: 201 },
    );
  }),

  http.patch("*/target-server/:name", async ({ params, request }) => {
    const payload = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ ...payload, name: String(params.name) });
  }),

  http.delete("*/target-server/:name", ({ params }) => {
    return HttpResponse.json({
      message: `Target server ${String(params.name)} removed successfully`,
    });
  }),

  http.put("*/config/target-server/:name/activate", ({ params }) => {
    return HttpResponse.json({
      message: `Target server ${String(params.name)} activated successfully`,
    });
  }),

  http.put("*/config/target-server/:name/deactivate", ({ params }) => {
    return HttpResponse.json({
      message: `Target server ${String(params.name)} deactivated successfully`,
    });
  }),

  http.patch("*/app-config", () => {
    return HttpResponse.json({
      yaml: "",
      version: 1,
      lastModified: "2026-05-11T08:00:00.000Z",
    });
  }),
];
