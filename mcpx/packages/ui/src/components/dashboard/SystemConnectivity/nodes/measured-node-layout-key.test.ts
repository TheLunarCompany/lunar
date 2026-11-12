import { describe, expect, it } from "vitest";

import type { McpServerStatus } from "@/types/mcp-server";
import { getMeasuredNodeLayoutKey } from "./measured-node-layout-key";

const baseServer = {
  id: "server-1",
  name: "github",
  status: "connected_running" as McpServerStatus,
  tools: [],
};

describe("getMeasuredNodeLayoutKey", () => {
  it("changes when an existing server status changes without changing server count", () => {
    const connectedKey = getMeasuredNodeLayoutKey({
      mcpServersData: [baseServer],
      agents: [],
      appConfig: null,
      mcpxStatus: "running",
      version: "1.0.0",
    });

    const pendingAuthKey = getMeasuredNodeLayoutKey({
      mcpServersData: [
        { ...baseServer, status: "pending_auth" as McpServerStatus },
      ],
      agents: [],
      appConfig: null,
      mcpxStatus: "running",
      version: "1.0.0",
    });

    expect(pendingAuthKey).not.toBe(connectedKey);
  });

  it("changes when app config marks an existing server inactive", () => {
    const activeKey = getMeasuredNodeLayoutKey({
      mcpServersData: [baseServer],
      agents: [],
      appConfig: null,
      mcpxStatus: "running",
      version: "1.0.0",
    });

    const inactiveKey = getMeasuredNodeLayoutKey({
      mcpServersData: [baseServer],
      agents: [],
      appConfig: {
        targetServerAttributes: {
          github: { inactive: true },
        },
      },
      mcpxStatus: "running",
      version: "1.0.0",
    });

    expect(inactiveKey).not.toBe(activeKey);
  });
});
