import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Agent } from "../../types/agent";

import { AgentDetailsModal } from "./AgentDetailsModal";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@/store", () => ({
  socketStore: {
    getState: () => ({
      systemState: {
        connectedClients: [
          {
            sessionId: "session-1",
            consumerTag: "agent-consumer",
            clientInfo: { name: "agent-consumer" },
          },
        ],
        targetServers: [{ name: "GitHub", icon: "" }],
      },
      appConfig: {
        permissions: {
          consumers: {},
        },
        targetServerAttributes: {},
      },
    }),
  },
  useAccessControlsStore: (
    selector: (state: {
      toolGroups: unknown[];
      profiles: unknown[];
      setProfiles: () => void;
    }) => unknown,
  ) =>
    selector({
      toolGroups: [
        {
          id: "group-1",
          name: "Version control & issue management",
          description: "Open new pull request",
          services: {
            GitHub: ["create_pull_request", "list_issues"],
          },
        },
      ],
      profiles: [],
      setProfiles: vi.fn(),
    }),
  useSocketStore: (
    selector: (state: { systemState: unknown; appConfig: unknown }) => unknown,
  ) =>
    selector({
      systemState: {
        connectedClients: [
          {
            sessionId: "session-1",
            consumerTag: "agent-consumer",
            clientInfo: { name: "agent-consumer" },
          },
        ],
        targetServers: [{ name: "GitHub", icon: "" }],
      },
      appConfig: {
        permissions: {
          consumers: {},
        },
        targetServerAttributes: {},
      },
    }),
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetContent: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  SheetDescription: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SheetHeader: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/SessionIdsTooltip", () => ({
  SessionIdsTooltip: () => <div>session-1</div>,
}));

vi.mock("@/hooks/useDomainIcon", () => ({
  useDomainIcon: () => null,
}));

vi.mock("@/config/runtime-config", () => ({
  isDynamicCapabilitiesEnabled: () => false,
}));

vi.mock("@/lib/api", () => ({
  apiClient: {
    getDynamicCapabilitiesStatus: vi.fn(() => Promise.resolve(false)),
  },
}));

vi.mock("@/components/ui/use-toast", () => ({
  toast: vi.fn(),
}));

const agent: Agent = {
  id: "agent-1",
  identifier: "agent-consumer",
  sessionIds: ["session-1"],
  status: "CONNECTED",
  usage: { callCount: 0 },
};

describe("AgentDetailsModal", () => {
  it("uses an accessible icon-only caret button for tool group expansion", () => {
    const html = renderToStaticMarkup(
      <AgentDetailsModal agent={agent} isOpen onClose={vi.fn()} />,
    );

    expect(html).toContain('aria-label="Expand tool group"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("Version control &amp; issue management");
    expect(html).not.toContain('data-slot="tooltip-trigger"');
    expect(html).not.toContain("View More");
    expect(html).not.toContain("View Less");
  });

  it("toggles tool group expansion when clicking the card content", () => {
    render(<AgentDetailsModal agent={agent} isOpen onClose={vi.fn()} />);

    expect(screen.queryByText("create_pull_request")).toBeNull();

    fireEvent.click(screen.getByText("Version control & issue management"));

    expect(screen.getByText("create_pull_request")).toBeTruthy();

    fireEvent.click(screen.getByText("2 tools"));

    expect(screen.queryByText("create_pull_request")).toBeNull();
  });
});
