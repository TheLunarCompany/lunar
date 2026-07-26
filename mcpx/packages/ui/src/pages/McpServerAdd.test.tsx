import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CatalogMCPServerConfigByNameItem } from "@mcpx/toolkit-ui/src/utils/server-helpers";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGetMCPServers } from "@/data/catalog-servers";
import { routes } from "@/routes";
import McpServerAdd from "./McpServerAdd";

const mocks = vi.hoisted(() => ({
  addServerAsync: vi.fn(),
  toast: vi.fn(),
  socketState: {
    systemState: {
      targetServers: [] as Array<{ name: string; catalogItemId?: string }>,
    },
  },
}));

vi.mock("@/data/catalog-servers", () => ({
  useGetMCPServers: vi.fn(),
}));
vi.mock("@/data/mcp-server", () => ({
  useAddMcpServer: () => ({ mutateAsync: mocks.addServerAsync }),
}));
vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));
vi.mock("@/hooks/useDomainIcon", () => ({
  useDomainIcon: () => undefined,
}));
vi.mock("@/store", () => ({
  useSocketStore: (
    selector: (state: typeof mocks.socketState) => unknown,
  ): unknown => selector(mocks.socketState),
}));

const githubServer = catalogServer({
  id: "0190a000-0000-7000-8000-000000000001",
  name: "github",
  displayName: "GitHub",
});
const linearServer = catalogServer({
  id: "0190a000-0000-7000-8000-000000000002",
  name: "linear",
  displayName: "Linear",
});

describe("McpServerAdd", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.socketState.systemState.targetServers = [];
    vi.mocked(useGetMCPServers).mockReturnValue({
      data: [githubServer, linearServer],
      isLoading: false,
      error: null,
    } as never);
  });

  it("starts selected requests in parallel and settles each card independently", async () => {
    const user = userEvent.setup();
    const githubRequest = deferred<{ name: string }>();
    const linearRequest = deferred<{ name: string }>();
    mocks.addServerAsync
      .mockReturnValueOnce(githubRequest.promise)
      .mockReturnValueOnce(linearRequest.promise);
    renderPage();

    await selectBothServers(user);
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(mocks.addServerAsync).toHaveBeenCalledTimes(2));
    expect(
      screen.getByRole("status", { name: "Adding GitHub" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Adding Linear" }),
    ).toBeInTheDocument();

    await act(async () => {
      githubRequest.resolve({ name: "github" });
      await githubRequest.promise;
    });

    expect(screen.getByText("Installed")).toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: "Adding GitHub" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Adding Linear" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("MCP servers route")).not.toBeInTheDocument();

    await act(async () => {
      linearRequest.resolve({ name: "linear" });
      await linearRequest.promise;
    });

    expect(await screen.findByText("MCP servers route")).toBeInTheDocument();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Servers Added",
        variant: "server-info",
      }),
    );
  });

  it("stays on the page after a partial failure and preserves failed selection", async () => {
    const user = userEvent.setup();
    mocks.addServerAsync
      .mockResolvedValueOnce({ name: "github" })
      .mockRejectedValueOnce(new Error("Linear credentials are invalid"));
    renderPage();

    await selectBothServers(user);
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(
      await screen.findByText(
        "1 server added successfully. Review the remaining errors and try again.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Linear credentials are invalid/),
    ).toBeInTheDocument();
    expect(screen.getByText("Installed")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Select Linear" }),
    ).toBeChecked();
    expect(
      screen.queryByRole("checkbox", { name: "Select GitHub" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("MCP servers route")).not.toBeInTheDocument();
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("stays on the page with failed servers selected after complete failure", async () => {
    const user = userEvent.setup();
    mocks.addServerAsync
      .mockRejectedValueOnce(new Error("GitHub token is missing"))
      .mockRejectedValueOnce(new Error("Linear credentials are invalid"));
    renderPage();

    await selectBothServers(user);
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(
      await screen.findByText(
        "Failed to add selected servers. Review the errors and try again.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/GitHub token is missing/)).toBeInTheDocument();
    expect(
      screen.getByText(/Linear credentials are invalid/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Select GitHub" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Select Linear" }),
    ).toBeChecked();
    expect(screen.queryByText("MCP servers route")).not.toBeInTheDocument();
    expect(mocks.toast).not.toHaveBeenCalled();
  });
});

function catalogServer({
  id,
  name,
  displayName,
}: {
  id: string;
  name: string;
  displayName: string;
}): CatalogMCPServerConfigByNameItem {
  return {
    id,
    name,
    displayName,
    description: `${displayName} MCP server`,
    link: `https://example.com/${name}`,
    config: {
      [name]: {
        type: "streamable-http",
        url: `https://example.com/${name}/mcp`,
      },
    },
  };
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function renderPage(): void {
  const router = createMemoryRouter(
    [
      { path: routes.mcpServerAdd, element: <McpServerAdd /> },
      { path: routes.mcpServers, element: <div>MCP servers route</div> },
    ],
    { initialEntries: [routes.mcpServerAdd] },
  );
  render(<RouterProvider router={router} />);
}

async function selectBothServers(
  user: ReturnType<typeof userEvent.setup>,
): Promise<void> {
  await user.click(screen.getByRole("checkbox", { name: "Select GitHub" }));
  await user.click(screen.getByRole("checkbox", { name: "Select Linear" }));
}
