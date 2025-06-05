import { McpxInstance } from "@mcpx/shared-model/api";

export function getSystemState(): McpxInstance {
  return {
    targetServers: [
      {
        name: "slack",
        tools: [
          {
            name: "sendMessage",
            description: "Post a message to a channel or user",
            usage: {
              callCount: 8,
              lastCalledAt: new Date(Date.parse("2025-05-28T11:59:30Z")),
            },
          },
          {
            name: "createChannel",
            description: "Create a public or private Slack channel",
            usage: {
              callCount: 1,
              lastCalledAt: new Date(Date.parse("2025-05-28T11:50:00Z")),
            },
          },
          {
            name: "listMessages",
            description: "Fetch message history for a channel",
            usage: {
              callCount: 0,
            },
          },
          {
            name: "deleteMessage",
            description: "Delete a previously-sent message",
            usage: {
              callCount: 0,
            },
          },
          {
            name: "uploadFile",
            description: "Upload and share a file",
            usage: {
              callCount: 2,
              lastCalledAt: new Date(Date.parse("2025-05-28T11:58:45Z")),
            },
          },
        ],
        usage: {
          callCount: 11,
          lastCalledAt: new Date(Date.parse("2025-05-28T11:59:30Z")),
        },
      },
      {
        name: "google-maps",
        tools: [
          {
            name: "geocodeAddress",
            description: "Convert a street address to latitude/longitude",
            usage: {
              callCount: 3,
              lastCalledAt: new Date(Date.parse("2025-05-28T11:30:00Z")),
            },
          },
          {
            name: "reverseGeocode",
            description: "Convert latitude/longitude to a street address",
            usage: {
              callCount: 0,
            },
          },
          {
            name: "searchPlaces",
            description: "Free-text search for nearby places",
            usage: {
              callCount: 5,
              lastCalledAt: new Date(Date.parse("2025-05-28T11:45:00Z")),
            },
          },
          {
            name: "getDirections",
            description: "Retrieve multi-step driving/walking directions",
            usage: {
              callCount: 0,
            },
          },
          {
            name: "getPlaceDetails",
            description: "Detailed metadata for a single place-ID",
            usage: {
              callCount: 0,
            },
          },
        ],
        usage: {
          callCount: 8,
          lastCalledAt: new Date(Date.parse("2025-05-28T11:45:00Z")),
        },
      },
      {
        name: "github",
        tools: [
          {
            name: "createIssue",
            description: "Open a new GitHub issue",
            usage: {
              callCount: 2,
              lastCalledAt: new Date(Date.parse("2025-05-28T11:35:00Z")),
            },
          },
          {
            name: "getRepo",
            description: "Fetch repository metadata",
            usage: {
              callCount: 0,
            },
          },
          {
            name: "listPullRequests",
            description: "List open pull requests",
            usage: {
              callCount: 1,
              lastCalledAt: new Date(Date.parse("2025-05-28T11:37:00Z")),
            },
          },
          {
            name: "mergePullRequest",
            description: "Merge an approved pull request",
            usage: {
              callCount: 0,
            },
          },
          {
            name: "createBranch",
            description: "Create a new branch reference",
            usage: {
              callCount: 0,
            },
          },
        ],
        usage: {
          callCount: 3,
          lastCalledAt: new Date(Date.parse("2025-05-28T11:37:00Z")),
        },
      },
    ],
    connectedClients: [
      {
        sessionId: "sess-20250528-ab55f",
        usage: {
          callCount: 12,
          lastCalledAt: new Date(Date.parse("2025-05-28T11:59:20Z")),
        },
        consumerTag: "marketing",
        llm: {
          provider: "gemini",
          model: "gemini-2.0-flash-exp",
        },
      },
      {
        sessionId: "sess-20250528-x96wl",
        usage: {
          callCount: 3,
          lastCalledAt: new Date(Date.parse("2025-05-28T11:40:00Z")),
        },
      },
    ],
    usage: {
      callCount: 22,
      lastCalledAt: new Date(Date.parse("2025-05-28T11:59:25Z")),
    },
    lastUpdatedAt: new Date(Date.parse("2025-05-28T12:00:00Z")),
  };
}
