import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  MultipleServersOptions,
  MultipleServersResult,
} from "@mcpx/toolkit-ui/src/utils/server-helpers";

import { AddServerModal } from "./AddServerModal";

type HandleMultipleServers = (
  options: MultipleServersOptions,
) => Promise<MultipleServersResult>;

let handleMultipleServersImpl: HandleMultipleServers = () =>
  Promise.resolve({
    successfulServers: ["linear"],
    failedServers: [],
    failedServerErrors: [],
  });
let handleMultipleServersPromise: Promise<MultipleServersResult> =
  Promise.resolve({
    successfulServers: ["linear"],
    failedServers: [],
    failedServerErrors: [],
  });

const successfulMultipleServersResult: MultipleServersResult = {
  successfulServers: ["linear"],
  failedServers: [],
  failedServerErrors: [],
};

const addServerMock = vi.fn();
const addServerAsyncMock = vi.fn();
const toastMock = vi.fn();

vi.mock("@/components/dashboard/constants", () => ({
  getMcpColorByName: () => "#5147E4",
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("radix-ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("radix-ui")>();
  return {
    ...actual,
    VisuallyHidden: {
      Root: ({ children }: { children: ReactNode }) => <>{children}</>,
    },
  };
});

vi.mock("@/components/ui/json-upload", () => ({
  JsonUpload: ({ onChange }: { onChange?: (value: string) => void }) => (
    <textarea
      aria-label="migrate-json"
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

vi.mock("@/components/ui/custom-tabs", () => ({
  CustomTabs: ({
    children,
    onValueChange,
  }: {
    children: ReactNode;
    onValueChange?: (value: string) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onValueChange?.("migrate")}>
        Migrate
      </button>
      {children}
    </div>
  ),
  CustomTabsContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  CustomTabsList: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  CustomTabsTrigger: ({
    children,
    value,
  }: {
    children: ReactNode;
    value: string;
  }) => (
    <button type="button">{value === "migrate" ? "Migrate" : children}</button>
  ),
}));

vi.mock("./McpJsonForm", () => ({
  McpJsonForm: () => <div data-testid="mcp-json-form" />,
}));

vi.mock("@/components/mcp-servers/McpRegistryCard", () => ({
  McpRegistryCard: () => <div data-testid="mcp-registry-card" />,
}));

vi.mock("@/data/mcp-server", () => ({
  useAddMcpServer: () => ({
    mutate: addServerMock,
    mutateAsync: addServerAsyncMock,
    isPending: false,
    error: null,
  }),
}));

vi.mock("@/data/catalog-servers", () => ({
  useGetMCPServers: () => ({ data: [] }),
}));

vi.mock("@/data/permissions", () => ({
  usePermissions: () => ({ canAddCustomServerAndEdit: true }),
}));

vi.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

vi.mock("@/hooks/useDomainIcon", () => ({
  getIconKey: () => null,
}));

vi.mock("@/config/runtime-config", () => ({
  CustomAddCheckboxText: () => "",
}));

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/store", () => ({
  useSocketStore: (
    selector: (state: {
      systemState: { targetServers: [] };
      appConfig: Record<string, never>;
    }) => unknown,
  ) =>
    selector({
      systemState: { targetServers: [] },
      appConfig: {},
    }),
}));

vi.mock("@mcpx/toolkit-ui/src/utils/server-helpers", async () => {
  const actual = await vi.importActual<
    typeof import("@mcpx/toolkit-ui/src/utils/server-helpers")
  >("@mcpx/toolkit-ui/src/utils/server-helpers");
  return {
    ...actual,
    handleMultipleServers: vi.fn((options) =>
      handleMultipleServersImpl(options),
    ),
  };
});

describe("AddServerModal", () => {
  beforeEach(() => {
    addServerMock.mockReset();
    addServerAsyncMock.mockReset();
    toastMock.mockReset();
    handleMultipleServersPromise = Promise.resolve(
      successfulMultipleServersResult,
    );
    handleMultipleServersImpl = () => handleMultipleServersPromise;
  });

  it("shows a loading state while saving migrated JSON uploads", () => {
    handleMultipleServersPromise = new Promise<MultipleServersResult>(() => {});

    render(<AddServerModal onClose={vi.fn()} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Migrate" })[0]);
    fireEvent.change(screen.getByLabelText("migrate-json"), {
      target: {
        value: JSON.stringify({
          linear: {
            type: "streamable-http",
            url: "https://mcp.linear.app/mcp",
          },
          atlassian: { type: "sse", url: "https://mcp.atlassian.com/v1/sse" },
        }),
      },
    });
    const addButtons = screen.getAllByRole("button", { name: "Add" });
    fireEvent.click(addButtons[addButtons.length - 1]);

    const savingButtons = screen.getAllByRole("button", { name: /Adding/i });
    expect(savingButtons[savingButtons.length - 1]).toBeDisabled();
    expect(screen.getAllByRole("status", { name: "Loading" })[0]).toBeVisible();
  });

  it("keeps partial multi-server adds visible as a warning instead of a failed-all error", async () => {
    handleMultipleServersImpl = async (options) => {
      options.addServer(
        {
          payload: {
            name: "linear",
            type: "streamable-http",
            url: "https://mcp.linear.app/mcp",
          },
        },
        { onSuccess: vi.fn(), onError: vi.fn() },
      );
      options.addServer(
        {
          payload: {
            name: "atlassian",
            type: "sse",
            url: "https://mcp.atlassian.com/v1/sse",
          },
        },
        { onSuccess: vi.fn(), onError: vi.fn() },
      );
      return {
        successfulServers: ["linear"],
        failedServers: ["atlassian"],
        failedServerErrors: [
          {
            serverName: "atlassian",
            error: "URL must start with https://",
          },
        ],
      };
    };
    addServerAsyncMock
      .mockResolvedValueOnce({ name: "linear" })
      .mockRejectedValueOnce(new Error("failed"));

    const onClose = vi.fn();
    render(<AddServerModal onClose={onClose} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Migrate" })[0]);
    fireEvent.change(screen.getByLabelText("migrate-json"), {
      target: {
        value: JSON.stringify({
          linear: {
            type: "streamable-http",
            url: "https://mcp.linear.app/mcp",
          },
          atlassian: { type: "sse", url: "https://mcp.atlassian.com/v1/sse" },
        }),
      },
    });
    const addButtons = screen.getAllByRole("button", { name: "Add" });
    fireEvent.click(addButtons[addButtons.length - 1]);

    expect(
      await screen.findByText("Added 1 server. Failed to add 1."),
    ).toBeVisible();
    const failedServerItem = screen.getByRole("listitem");
    expect(within(failedServerItem).getByText("atlassian")).toBeVisible();
    expect(
      within(failedServerItem).getByText(/URL must start with https:\/\//),
    ).toBeVisible();
    expect(
      screen.queryByText(/Failed to add all servers/i),
    ).not.toBeInTheDocument();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        descriptionClassName: "line-clamp-none text-current font-medium",
        duration: 20000,
        title: "Some Servers Added",
        variant: "warning",
      }),
    );
    const toastDescription = toastMock.mock.calls[0]?.[0].description;
    const toastView = render(<>{toastDescription}</>);
    const toastScope = within(toastView.container);
    expect(toastScope.getByText(/Added/)).toBeVisible();
    expect(
      toastScope.getByRole("button", { name: "Show details" }),
    ).toBeVisible();
    expect(toastScope.queryByText(/URL must start with https:\/\//)).toBeNull();
    fireEvent.click(toastScope.getByRole("button", { name: "Show details" }));
    expect(toastScope.getByText("atlassian")).toBeVisible();
    expect(
      toastScope.getByText(/URL must start with https:\/\//),
    ).toBeVisible();
    expect(
      toastScope.getByRole("button", { name: "Hide details" }),
    ).toBeVisible();
    expect(addServerAsyncMock).toHaveBeenCalledTimes(2);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows all failed multi-server errors as bullet points", async () => {
    handleMultipleServersImpl = async () => ({
      successfulServers: [],
      failedServers: ["linear", "time"],
      failedServerErrors: [
        {
          serverName: "linear",
          error:
            'Server with name "linear" already in catalog. Use the catalog or change the server name',
        },
        {
          serverName: "time",
          error:
            'Server with name "time" already in catalog. Use the catalog or change the server name',
        },
      ],
    });

    render(<AddServerModal onClose={vi.fn()} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Migrate" })[0]);
    fireEvent.change(screen.getByLabelText("migrate-json"), {
      target: {
        value: JSON.stringify({
          linear: {
            type: "streamable-http",
            url: "https://mcp.linear.app/mcp",
          },
          time: {
            type: "stdio",
            command: "uvx",
            args: ["mcp-server-time"],
          },
        }),
      },
    });
    const addButtons = screen.getAllByRole("button", { name: "Add" });
    fireEvent.click(addButtons[addButtons.length - 1]);

    expect(await screen.findByText("No servers were added.")).toBeVisible();
    const failedServerItems = screen.getAllByRole("listitem");
    expect(failedServerItems).toHaveLength(2);
    expect(within(failedServerItems[0]).getByText("linear")).toBeVisible();
    expect(
      within(failedServerItems[0]).getByText(/already in catalog/),
    ).toBeVisible();
    expect(within(failedServerItems[1]).getByText("time")).toBeVisible();
    expect(
      screen.queryByText(/No servers were added\. Failed:/i),
    ).not.toBeInTheDocument();
  });
});
