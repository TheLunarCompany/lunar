// Mock fixtures for the mcpx-server -> mcpx-ui system-state contract.
//
// These conform to `connectedClientSchema` (proven by system-state.mocks.test.ts)
// so the UI can build and story-test the dashboard against the real contract
// before the server emits live data. Timestamps are fixed for deterministic
// stories and snapshots.

import { ConnectedClient } from "../api/system-state.js";

// Fixed epoch ms so fixtures are deterministic across renders and snapshots.
export const MOCK_BASE_TS = 1_700_000_000_000;

// Build a connected client, overriding any field. Defaults to a healthy,
// connected, dynamic-mode-off session with no visible tools.
export function buildConnectedClientMock(
  overrides: Partial<ConnectedClient> = {},
): ConnectedClient {
  return {
    sessionId: "sess-0001",
    clientId: "client-alpha",
    usage: { callCount: 3, lastCalledAt: new Date(MOCK_BASE_TS) },
    consumerTag: "team-alpha",
    clientInfo: { name: "cursor", version: "1.6.0" },
    dynamicMode: false,
    visibleTools: [],
    lastSeenAt: MOCK_BASE_TS,
    connectionState: "connected",
    ...overrides,
  };
}

// A healthy agent in dynamic mode with a couple of unlocked tools.
export const connectedClientMock: ConnectedClient = buildConnectedClientMock({
  sessionId: "sess-connected",
  clientId: "client-alpha",
  dynamicMode: true,
  visibleTools: [
    { serverName: "github", toolName: "search_issues" },
    { serverName: "slack", toolName: "send_message" },
  ],
  connectionState: "connected",
});

// A live agent that has started missing pings (staleness indicator).
export const unresponsiveClientMock: ConnectedClient = buildConnectedClientMock(
  {
    sessionId: "sess-unresponsive",
    clientId: "client-beta",
    consumerTag: "team-beta",
    clientInfo: { name: "claude-desktop", version: "1.2.0" },
    dynamicMode: false,
    lastSeenAt: MOCK_BASE_TS - 30_000,
    connectionState: "unresponsive",
  },
);

// An agent that was connected before an MCPX restart or hibernation, shown
// offline until its session id returns.
export const disconnectedClientMock: ConnectedClient = buildConnectedClientMock(
  {
    sessionId: "sess-disconnected",
    clientId: "client-gamma",
    consumerTag: "team-gamma",
    clientInfo: { name: "vscode", version: "0.9.0" },
    dynamicMode: true,
    visibleTools: [{ serverName: "jira", toolName: "create_ticket" }],
    lastSeenAt: MOCK_BASE_TS - 600_000,
    connectionState: "disconnected",
    disconnectedAt: MOCK_BASE_TS - 600_000,
  },
);

// All three connection states, for rendering the dashboard against every case.
export const connectedClientMocks: ConnectedClient[] = [
  connectedClientMock,
  unresponsiveClientMock,
  disconnectedClientMock,
];
