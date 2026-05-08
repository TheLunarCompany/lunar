import type { AppConfig, SystemState } from "@mcpx/shared-model";
import { socketStore } from "@/store/socket";
import { toolsStore } from "@/store/tools";

const mockSystemState: SystemState = {
  usage: { callCount: 24, lastCalledAt: new Date() },
  lastUpdatedAt: new Date(),
  mcpxVersion: "0.4.28-dev-mock",
  connectedClients: [
    {
      sessionId: "session-dev-cursor",
      clientId: "client-dev-cursor",
      consumerTag: "Cursor",
      usage: { callCount: 12, lastCalledAt: new Date() },
      llm: {},
      clientInfo: {
        protocolVersion: "2025-11-25",
        name: "cursor-vscode",
        version: "1.0.0",
      },
    },
  ],
  connectedClientClusters: [
    {
      identityType: "clientName",
      clientName: "cursor-vscode",
      sessionIds: ["session-dev-cursor"],
      usage: { callCount: 12, lastCalledAt: new Date() },
    },
  ],
  targetServers: [
    {
      _type: "stdio",
      name: "figma-community",
      catalogItemId: "019cd1f6-1f46-7371-8be9-01b0ebe6c73a",
      command: "npx",
      args: [
        "-y",
        "figma-developer-mcp",
        "--figma-api-key=YOUR-KEY",
        "--stdio",
      ],
      env: {
        FIGMA_API_KEY: {
          fromEnv: "MCPX_FIGMA_COMMUNITY_FIGMA_API_KEY_PREFILLED",
        },
      },
      state: { type: "connected" },
      usage: { callCount: 18, lastCalledAt: new Date() },
      tools: [
        {
          name: "get_figma_data",
          description:
            "Get comprehensive Figma file data including layout, content, visuals, and component information",
          annotations: { readOnlyHint: true },
          inputSchema: {
            type: "object",
            properties: {
              fileKey: {
                type: "string",
                pattern: "^[a-zA-Z0-9]+$",
                description: "The key of the Figma file to fetch",
              },
              nodeId: {
                type: "string",
                description: "The ID of the node to fetch",
              },
            },
            required: ["fileKey"],
            additionalProperties: false,
          },
          usage: { callCount: 10, lastCalledAt: new Date() },
        },
        {
          name: "download_figma_images",
          description:
            "Download SVG and PNG images used in a Figma file based on the IDs of image or icon nodes.",
          annotations: { openWorldHint: true },
          inputSchema: {
            type: "object",
            properties: {
              fileKey: {
                type: "string",
                pattern: "^[a-zA-Z0-9]+$",
                description: "The key of the Figma file containing the images",
              },
              nodes: {
                type: "array",
                description: "The nodes to fetch as images",
                items: {
                  type: "object",
                  properties: {
                    nodeId: { type: "string" },
                    fileName: { type: "string" },
                  },
                  required: ["nodeId", "fileName"],
                  additionalProperties: false,
                },
              },
              localPath: {
                type: "string",
                description: "The path where images should be saved",
              },
            },
            required: ["fileKey", "nodes", "localPath"],
            additionalProperties: false,
          },
          usage: { callCount: 8, lastCalledAt: new Date() },
        },
      ],
      originalTools: [
        {
          name: "get_figma_data",
          title: "Get Figma Data",
          description:
            "Get comprehensive Figma file data including layout, content, visuals, and component information",
          annotations: { readOnlyHint: true },
          inputSchema: {
            type: "object",
            properties: {
              fileKey: {
                type: "string",
                pattern: "^[a-zA-Z0-9]+$",
                description: "The key of the Figma file to fetch",
              },
              nodeId: {
                type: "string",
                description: "The ID of the node to fetch",
              },
            },
            required: ["fileKey"],
            additionalProperties: false,
          },
          execution: { taskSupport: "forbidden" },
        },
        {
          name: "download_figma_images",
          title: "Download Figma Images",
          description:
            "Download SVG and PNG images used in a Figma file based on the IDs of image or icon nodes.",
          annotations: { openWorldHint: true },
          inputSchema: {
            type: "object",
            properties: {
              fileKey: {
                type: "string",
                pattern: "^[a-zA-Z0-9]+$",
                description: "The key of the Figma file containing the images",
              },
              nodes: {
                type: "array",
                description: "The nodes to fetch as images",
                items: {
                  type: "object",
                  properties: {
                    nodeId: { type: "string" },
                    fileName: { type: "string" },
                  },
                  required: ["nodeId", "fileName"],
                  additionalProperties: false,
                },
              },
              localPath: {
                type: "string",
                description: "The path where images should be saved",
              },
            },
            required: ["fileKey", "nodes", "localPath"],
            additionalProperties: false,
          },
          execution: { taskSupport: "forbidden" },
        },
      ],
    },
    {
      _type: "stdio",
      name: "playwright",
      catalogItemId: "bb4aa5f0-8263-456e-b1d5-ce887d6e381a",
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
      state: { type: "connected" },
      usage: { callCount: 6, lastCalledAt: new Date() },
      tools: [
        {
          name: "browser_close",
          description: "Close the page",
          annotations: {
            title: "Close browser",
            readOnlyHint: false,
            destructiveHint: true,
            openWorldHint: true,
          },
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
          usage: { callCount: 0 },
        },
        {
          name: "browser_console_messages",
          description: "Returns all console messages",
          annotations: {
            title: "Get console messages",
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: true,
          },
          inputSchema: {
            type: "object",
            properties: {
              level: {
                default: "info",
                type: "string",
                enum: ["error", "warning", "info", "debug"],
              },
            },
            required: ["level"],
            additionalProperties: false,
          },
          usage: { callCount: 0 },
        },
        {
          name: "browser_network_requests",
          description: "Returns all network requests since loading the page",
          annotations: {
            title: "List network requests",
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: true,
          },
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
          usage: { callCount: 0 },
        },
        {
          name: "browser_navigate",
          description: "Navigate to a URL",
          annotations: {
            title: "Navigate to a URL",
            readOnlyHint: false,
            destructiveHint: true,
            openWorldHint: true,
          },
          inputSchema: {
            type: "object",
            properties: {
              url: { type: "string", description: "The URL to navigate to" },
            },
            required: ["url"],
            additionalProperties: false,
          },
          usage: { callCount: 0 },
        },
        {
          name: "browser_take_screenshot",
          description: "Take a screenshot of the current page.",
          annotations: {
            title: "Take a screenshot",
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: true,
          },
          inputSchema: {
            type: "object",
            properties: {
              type: {
                default: "png",
                type: "string",
                enum: ["png", "jpeg"],
              },
            },
            required: ["type"],
            additionalProperties: false,
          },
          usage: { callCount: 0 },
        },
        {
          name: "browser_run_code_unsafe",
          description: "Run arbitrary JavaScript in the page context",
          annotations: {
            title: "Run unsafe browser code",
            readOnlyHint: false,
            destructiveHint: true,
            openWorldHint: true,
          },
          inputSchema: {
            type: "object",
            properties: {
              code: {
                type: "string",
                description: "JavaScript code to evaluate in the page",
              },
            },
            required: ["code"],
            additionalProperties: false,
          },
          usage: { callCount: 0 },
        },
      ],
      originalTools: [
        {
          name: "browser_close",
          description: "Close the page",
          annotations: {
            title: "Close browser",
            readOnlyHint: false,
            destructiveHint: true,
            openWorldHint: true,
          },
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
        },
        {
          name: "browser_console_messages",
          description: "Returns all console messages",
          annotations: {
            title: "Get console messages",
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: true,
          },
          inputSchema: {
            type: "object",
            properties: {
              level: {
                default: "info",
                type: "string",
                enum: ["error", "warning", "info", "debug"],
              },
            },
            required: ["level"],
            additionalProperties: false,
          },
        },
        {
          name: "browser_navigate",
          description: "Navigate to a URL",
          annotations: {
            title: "Navigate to a URL",
            readOnlyHint: false,
            destructiveHint: true,
            openWorldHint: true,
          },
          inputSchema: {
            type: "object",
            properties: {
              url: { type: "string", description: "The URL to navigate to" },
            },
            required: ["url"],
            additionalProperties: false,
          },
        },
        {
          name: "browser_network_requests",
          description: "Returns all network requests since loading the page",
          annotations: {
            title: "List network requests",
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: true,
          },
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
        },
        {
          name: "browser_take_screenshot",
          description: "Take a screenshot of the current page.",
          annotations: {
            title: "Take a screenshot",
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: true,
          },
          inputSchema: {
            type: "object",
            properties: {
              type: {
                default: "png",
                type: "string",
                enum: ["png", "jpeg"],
              },
            },
            required: ["type"],
            additionalProperties: false,
          },
        },
        {
          name: "browser_run_code_unsafe",
          description: "Run arbitrary JavaScript in the page context",
          annotations: {
            title: "Run unsafe browser code",
            readOnlyHint: false,
            destructiveHint: true,
            openWorldHint: true,
          },
          inputSchema: {
            type: "object",
            properties: {
              code: {
                type: "string",
                description: "JavaScript code to evaluate in the page",
              },
            },
            required: ["code"],
            additionalProperties: false,
          },
        },
      ],
    },
    {
      _type: "stdio",
      name: "launchdarkly",
      catalogItemId: "66acc893-b286-4571-8ef6-da22d548413d",
      command: "npx",
      args: ["-y", "--package", "@launchdarkly/mcp-server", "--", "mcp"],
      env: { API_KEY: "api-test" },
      state: { type: "connected" },
      usage: { callCount: 0 },
      tools: [
        {
          name: "get-code-references",
          description:
            "Identifies which repositories have code references to a given flag.",
          inputSchema: {
            type: "object",
            properties: {
              request: {
                type: "object",
                properties: {
                  projKey: { type: "string" },
                  flagKey: { type: "string" },
                },
                additionalProperties: false,
              },
            },
            required: ["request"],
            additionalProperties: false,
          },
          usage: { callCount: 0 },
        },
        {
          name: "list-feature-flags",
          description:
            "Retrieves all feature flags within a project, including metadata and targeting rules.",
          inputSchema: {
            type: "object",
            properties: {
              request: {
                type: "object",
                properties: {
                  projectKey: { type: "string" },
                  env: { type: "string" },
                },
                required: ["projectKey"],
                additionalProperties: false,
              },
            },
            required: ["request"],
            additionalProperties: false,
          },
          usage: { callCount: 0 },
        },
        {
          name: "create-feature-flag",
          description: "Creates a new feature flag within a project.",
          inputSchema: {
            type: "object",
            properties: {
              request: {
                type: "object",
                properties: {
                  projectKey: { type: "string" },
                  FeatureFlagBody: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      key: { type: "string" },
                    },
                    required: ["name", "key"],
                    additionalProperties: false,
                  },
                },
                required: ["projectKey", "FeatureFlagBody"],
                additionalProperties: false,
              },
            },
            required: ["request"],
            additionalProperties: false,
          },
          usage: { callCount: 0 },
        },
      ],
      originalTools: [
        {
          name: "get-code-references",
          description:
            "Identifies which repositories have code references to a given flag.",
          inputSchema: {
            type: "object",
            properties: {
              request: {
                type: "object",
                properties: {
                  projKey: { type: "string" },
                  flagKey: { type: "string" },
                },
                additionalProperties: false,
              },
            },
            required: ["request"],
            additionalProperties: false,
          },
          execution: { taskSupport: "forbidden" },
        },
        {
          name: "list-feature-flags",
          description:
            "Retrieves all feature flags within a project, including metadata and targeting rules.",
          inputSchema: {
            type: "object",
            properties: {
              request: {
                type: "object",
                properties: {
                  projectKey: { type: "string" },
                  env: { type: "string" },
                },
                required: ["projectKey"],
                additionalProperties: false,
              },
            },
            required: ["request"],
            additionalProperties: false,
          },
          execution: { taskSupport: "forbidden" },
        },
        {
          name: "create-feature-flag",
          description: "Creates a new feature flag within a project.",
          inputSchema: {
            type: "object",
            properties: {
              request: {
                type: "object",
                properties: {
                  projectKey: { type: "string" },
                  FeatureFlagBody: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      key: { type: "string" },
                    },
                    required: ["name", "key"],
                    additionalProperties: false,
                  },
                },
                required: ["projectKey", "FeatureFlagBody"],
                additionalProperties: false,
              },
            },
            required: ["request"],
            additionalProperties: false,
          },
          execution: { taskSupport: "forbidden" },
        },
      ],
    },
    {
      _type: "stdio",
      name: "context7",
      catalogItemId: "96d65ec5-8d57-4d27-a5cd-6c488817c827",
      command: "npx",
      args: ["-y", "@upstash/context7-mcp"],
      env: {
        API_KEY: { fromEnv: "MCPX_CONTEXT7_API_KEY_PREFILLED" },
      },
      state: {
        type: "pending-input",
        missingEnvVars: [
          {
            key: "API_KEY",
            type: "fromEnv",
            fromEnvName: "MCPX_CONTEXT7_API_KEY_PREFILLED",
          },
        ],
      },
      usage: { callCount: 0 },
      tools: [],
      originalTools: [],
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
      name: "LaunchDarkly Read",
      services: {
        launchdarkly: ["get-code-references", "list-feature-flags"],
      },
    },
    {
      name: "Browser Inspection",
      services: {
        playwright: [
          "browser_console_messages",
          "browser_network_requests",
          "browser_take_screenshot",
        ],
      },
    },
    {
      name: "Design Assets",
      services: {
        "figma-community": ["get_figma_data", "download_figma_images"],
      },
    },
  ],
  toolExtensions: {
    services: {
      launchdarkly: {
        "list-feature-flags": {
          childTools: [
            {
              name: "list-production-flags",
              description: {
                action: "rewrite",
                text: "List LaunchDarkly feature flags for the production environment",
              },
              overrideParams: {
                request: {
                  description: {
                    action: "rewrite",
                    text: "LaunchDarkly project request. The production environment is preselected.",
                  },
                },
              },
            },
          ],
        },
      },
    },
  },
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
        "toolGroups: []",
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
