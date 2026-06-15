import { http, HttpResponse } from "msw";
import type {
  CatalogMCPServerItem,
  CatalogMCPServerList,
} from "@mcpx/shared-model";

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

const PLAYWRIGHT_CATALOG_ITEM_ID = "018f6f21-668f-7357-b1e5-7b3ba814d195";
const STDIO_MCP_SERVERS_NOT_ALLOWED_RESPONSE = {
  message:
    "This organization does not allow STDIO MCP servers. Contact your administrator for access.",
  error: {
    errorName: "NotAllowedError",
    errorMessage:
      "This organization does not allow STDIO MCP servers. Contact your administrator for access.",
  },
};

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
}

export const handlers = [
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
];
