import type { NodeProps } from "@xyflow/react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Agent } from "@/types";
import { TooltipProvider } from "@/components/ui/tooltip";
import AgentNodeRenderer from "./AgentNodeRenderer";
import type { AgentNode } from "../types";

// The badge falls back to the connected-tools count when not in dynamic mode.
const CONNECTED_TOOLS_COUNT = 5;

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Right: "right" },
}));

vi.mock("@/store", () => ({
  useModalsStore: (
    selector: (state: { selectedAgent: undefined }) => unknown,
  ) => selector({ selectedAgent: undefined }),
}));

vi.mock("@/hooks/useToolCount", () => ({
  useToolCount: () => ({
    availableTools: CONNECTED_TOOLS_COUNT,
    totalConnectedTools: CONNECTED_TOOLS_COUNT,
  }),
}));

function createAgentData(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "agent-1",
    identifier: "team-platform",
    sessionIds: ["s1"],
    status: "connected",
    lastActivity: null,
    usage: { callCount: 0, lastCalledAt: null },
    dynamicMode: false,
    visibleTools: [],
    connectionState: "connected",
    identityType: "consumerTag",
    consumerTag: "team-platform",
    clientNames: ["claude-code"],
    ...overrides,
  } as Agent;
}

function renderNode(data: Agent) {
  const props = { data, selected: false } as unknown as NodeProps<AgentNode>;
  return render(
    <TooltipProvider>
      <AgentNodeRenderer {...props} />
    </TooltipProvider>,
  );
}

describe("AgentNodeRenderer", () => {
  it("shows the connected-tools count when not in dynamic mode", () => {
    const { getByText } = renderNode(createAgentData());
    expect(getByText(String(CONNECTED_TOOLS_COUNT))).toBeInTheDocument();
  });

  it("shows the visible-tools count when in dynamic mode", () => {
    const { getByText } = renderNode(
      createAgentData({
        dynamicMode: true,
        visibleTools: [
          { serverName: "jira", toolName: "create_ticket" },
          { serverName: "github", toolName: "search_issues" },
        ],
      }),
    );
    expect(getByText("2")).toBeInTheDocument();
  });

  it("renders no health indicator when connected", () => {
    const { container } = renderNode(createAgentData());
    expect(container.querySelector("svg.lucide-wifi-off")).toBeNull();
    expect(container.querySelector('[data-variant="disabled"]')).toBeNull();
  });

  it("renders an amber WifiOff when unresponsive", () => {
    const { container } = renderNode(
      createAgentData({ connectionState: "unresponsive" }),
    );
    const icon = container.querySelector("svg.lucide-wifi-off");
    expect(icon).not.toBeNull();
    expect(icon?.classList.contains("text-amber-500")).toBe(true);
    // Unresponsive agents are live, so the card is not greyed out.
    expect(container.querySelector('[data-variant="disabled"]')).toBeNull();
  });

  it("renders a gray card with a WifiOff when disconnected", () => {
    const { container } = renderNode(
      createAgentData({ connectionState: "disconnected" }),
    );
    const icon = container.querySelector("svg.lucide-wifi-off");
    expect(icon).not.toBeNull();
    expect(icon?.classList.contains("text-amber-500")).toBe(false);
    expect(container.querySelector('[data-variant="disabled"]')).not.toBeNull();
  });
});
