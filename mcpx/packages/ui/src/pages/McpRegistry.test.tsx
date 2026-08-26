import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CatalogMCPServerConfigByNameItem } from "@mcpx/toolkit-ui/src/utils/server-helpers";
import type { TargetServer } from "@mcpx/shared-model";
import {
  createMemoryRouter,
  MemoryRouter,
  RouterProvider,
} from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { routes } from "@/routes";
import McpRegistry from "./McpRegistry";

const mocks = vi.hoisted(() => ({
  addError: null as Error | null,
  addServer: vi.fn(),
  addServerAsync: vi.fn(),
  canAddCustom: true,
  catalogServers: [] as CatalogMCPServerConfigByNameItem[],
  socketState: {
    appConfig: { targetServerAttributes: {} },
    systemState: { targetServers: [] as TargetServer[] },
  },
  toast: vi.fn(),
}));

vi.mock("@/data/catalog-servers", () => ({
  useGetMCPServers: () => ({ data: mocks.catalogServers }),
}));

vi.mock("@/data/mcp-server", () => ({
  useAddMcpServer: () => ({
    mutate: mocks.addServer,
    mutateAsync: mocks.addServerAsync,
    isPending: false,
    error: mocks.addError,
  }),
}));

vi.mock("@/data/permissions", () => ({
  usePermissions: () => ({
    canAddCustomServerAndEdit: mocks.canAddCustom,
  }),
}));

vi.mock("@/store", () => ({
  useSocketStore: (
    selector: (state: typeof mocks.socketState) => unknown,
  ): unknown => selector(mocks.socketState),
}));

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/hooks/useDomainIcon", () => ({
  useDomainIcon: () => "",
}));

vi.mock("@/components/dashboard/McpJsonForm", () => ({
  McpJsonForm: ({
    onChange,
    value,
  }: {
    onChange?: (value: string) => void;
    value?: string;
  }) => (
    <textarea
      aria-label="Custom server JSON"
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

vi.mock("@/components/ui/json-upload", () => ({
  JsonUpload: ({
    onChange,
    value,
  }: {
    onChange?: (value: string) => void;
    value?: string;
  }) => (
    <textarea
      aria-label="Migrated server JSON"
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

const githubCatalogServer: CatalogMCPServerConfigByNameItem = {
  id: "0190a000-0000-7000-8000-000000000001",
  name: "github",
  displayName: "GitHub",
  description: "GitHub MCP server",
  config: {
    github: {
      type: "stdio",
      command: "npx",
      args: ["-y", "@example/github-mcp"],
      env: {
        GITHUB_TOKEN: { kind: "required", isSecret: true },
      },
    },
  },
};

describe("McpRegistry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.addError = null;
    mocks.canAddCustom = true;
    mocks.catalogServers = [githubCatalogServer];
    mocks.socketState.systemState.targetServers = [];
  });

  it("hides custom and migrate tabs without edit permission", () => {
    mocks.canAddCustom = false;

    renderRegistry();

    expect(screen.getByRole("tab", { name: "All" })).toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "Custom" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "Migrate" }),
    ).not.toBeInTheDocument();
  });

  it("adds a catalog server and navigates to the dashboard", async () => {
    const user = userEvent.setup();
    mocks.addServer.mockImplementation(
      (
        _variables: unknown,
        callbacks: { onSuccess: (server: { name: string }) => void },
      ) => callbacks.onSuccess({ name: "github" }),
    );
    const router = createMemoryRouter(
      [
        { path: routes.mcpRegistry, element: <McpRegistry /> },
        { path: routes.dashboard, element: <div>Dashboard route</div> },
      ],
      { initialEntries: [routes.mcpRegistry] },
    );
    render(<RouterProvider router={router} />);

    await user.click(screen.getByRole("button", { name: "Add GitHub" }));

    expect(await screen.findByText("Dashboard route")).toBeInTheDocument();
    expect(mocks.addServer).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          catalogItemId: githubCatalogServer.id,
          name: "github",
        }),
      }),
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Server Added" }),
    );
  });

  it("shows catalog add failures on the All tab", async () => {
    const user = userEvent.setup();
    const view = renderRegistry();

    await user.click(screen.getByRole("button", { name: "Add GitHub" }));
    mocks.addError = new Error("GitHub credentials are invalid");
    view.rerender(
      <MemoryRouter>
        <McpRegistry />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("GitHub credentials are invalid"),
    ).toBeInTheDocument();
  });

  it("shows installed status instead of an add action", () => {
    mocks.socketState.systemState.targetServers = [
      createInstalledGithubServer(),
    ];

    renderRegistry();

    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add GitHub" }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["Custom", "Custom server JSON"],
    ["Migrate", "Migrated server JSON"],
  ])("rejects invalid JSON from the %s tab", async (tabName, editorLabel) => {
    const user = userEvent.setup();
    renderRegistry();

    await user.click(screen.getByRole("tab", { name: tabName }));
    fireEvent.change(screen.getByLabelText(editorLabel), {
      target: { value: "not-json" },
    });
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByText("Invalid JSON format")).toBeInTheDocument();
    expect(mocks.addServer).not.toHaveBeenCalled();
  });
});

function renderRegistry() {
  return render(
    <MemoryRouter>
      <McpRegistry />
    </MemoryRouter>,
  );
}

function createInstalledGithubServer(): TargetServer {
  return {
    _type: "stdio",
    name: "github",
    catalogItemId: githubCatalogServer.id,
    command: "npx",
    state: { type: "connected" },
    tools: [],
    originalTools: [],
    prompts: [],
    originalPrompts: [],
    usage: { callCount: 0 },
  };
}
