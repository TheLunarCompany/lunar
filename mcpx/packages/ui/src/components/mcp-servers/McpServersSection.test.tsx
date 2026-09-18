import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TargetServer } from "@mcpx/shared-model";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { routes } from "@/routes";
import { McpServersSection } from "./McpServersSection";

type StdioTargetServer = Extract<TargetServer, { _type: "stdio" }>;

const mocks = vi.hoisted(() => ({
  initiateServerAuth: vi.fn(),
  socketState: {
    appConfig: {
      targetServerAttributes: {},
      toolExtensions: { services: {} },
    },
  },
}));

vi.mock("@/store", () => ({
  useSocketStore: (
    selector: (state: typeof mocks.socketState) => unknown,
  ): unknown => selector(mocks.socketState),
}));

vi.mock("@/hooks/useDomainIcon", () => ({
  useDomainIcon: () => undefined,
}));

vi.mock("@/hooks/useServerInactive", () => ({
  useServerInactive: () => false,
}));

vi.mock("@/data/server-auth", () => ({
  useInitiateServerAuth: () => ({ mutate: mocks.initiateServerAuth }),
}));

vi.mock("@/components/capabilities/capability-actions", () => ({
  createCustomCapabilityTool: vi.fn(),
  deleteCustomCapabilityTool: vi.fn(),
  updateCustomCapabilityTool: vi.fn(),
}));

const connectedServer = createServer();

describe("McpServersSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("links the zero state to the add-server page", () => {
    renderSection([]);

    expect(screen.getByText("No Servers Found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add Server" })).toHaveAttribute(
      "href",
      routes.mcpServerAdd,
    );
  });

  it("expands a server and switches between tool and prompt tabs", async () => {
    const user = userEvent.setup();
    renderSection([connectedServer]);

    await user.click(screen.getByRole("button", { name: /github/i }));

    expect(screen.getByRole("tab", { name: "Tools 1" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("create_issue")).toBeInTheDocument();
    expect(screen.queryByText("release_notes")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Prompts 1" }));

    expect(screen.getByText("release_notes")).toBeInTheDocument();
    expect(screen.queryByText("create_issue")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Resources" })).toBeDisabled();
  });

  it("filters servers by capability name", async () => {
    const user = userEvent.setup();
    renderSection([connectedServer]);

    await user.type(
      screen.getByPlaceholderText("Search tools, prompts and resources"),
      "missing capability",
    );

    expect(screen.getByText("No tools available.")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /github/i }),
    ).not.toBeInTheDocument();
  });

  it("opens customization from a server tool action", async () => {
    const user = userEvent.setup();
    renderSection([connectedServer]);

    await user.click(screen.getByRole("button", { name: /github/i }));
    await user.click(
      screen.getByRole("button", { name: "Open create_issue menu" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Customize" }));

    expect(
      screen.getByRole("dialog", { name: "Customize Tool" }),
    ).toBeInTheDocument();
  });

  it("starts authentication for a pending-auth server", async () => {
    const user = userEvent.setup();
    const pendingAuthServer = createServer({
      state: { type: "pending-auth" },
      tools: [],
      originalTools: [],
      prompts: [],
      originalPrompts: [],
    });
    renderSection([pendingAuthServer]);

    await user.click(screen.getByRole("button", { name: /github/i }));
    expect(screen.getByText("Authentication required")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Authenticate" }));

    expect(mocks.initiateServerAuth).toHaveBeenCalledWith(
      { serverName: "github" },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
  });
});

function renderSection(servers: TargetServer[]) {
  return render(
    <MemoryRouter>
      <McpServersSection servers={servers} />
    </MemoryRouter>,
  );
}

function createServer(
  overrides: Partial<StdioTargetServer> = {},
): StdioTargetServer {
  return {
    _type: "stdio",
    name: "github",
    command: "npx",
    args: ["-y", "@example/github-mcp"],
    state: { type: "connected" },
    tools: [
      {
        name: "create_issue",
        description: "Create a GitHub issue",
        inputSchema: {
          type: "object",
          properties: { title: { type: "string" } },
        },
        annotations: { destructiveHint: false },
        usage: { callCount: 0 },
      },
    ],
    originalTools: [
      {
        name: "create_issue",
        description: "Create a GitHub issue",
        inputSchema: {
          type: "object",
          properties: { title: { type: "string" } },
        },
        annotations: { destructiveHint: false },
      },
    ],
    prompts: [
      {
        name: "release_notes",
        description: "Prepare release notes",
        arguments: [{ name: "version", required: true }],
        usage: { callCount: 0 },
      },
    ],
    originalPrompts: [
      {
        name: "release_notes",
        description: "Prepare release notes",
        arguments: [{ name: "version", required: true }],
      },
    ],
    usage: { callCount: 0 },
    ...overrides,
  };
}
