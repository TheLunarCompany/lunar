import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { socketStore } from "@/store";
import type { Skill } from "@mcpx/shared-model";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SkillCard } from "./SkillCard";

const navigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigate };
});

const skill: Skill = {
  id: "0190a000-0000-7000-8000-000000000001",
  name: "review-pull-requests",
  description: "Review repository changes.",
  body: "# Review",
  exposeAsPrompt: true,
  author: { setupOwnerId: "o", displayName: "Amir" },
  capabilityGroup: {
    name: "filesystem",
    items: [
      {
        catalogItemId: "filesystem",
        tools: ["read_file", "write_file"],
        prompts: ["summarize_file"],
      },
    ],
  },
  updatedAt: new Date("2026-06-29T10:00:00.000Z"),
};

function renderCard(
  onDelete = vi.fn(),
  providers: string[] = [],
  counts = { toolsCount: 2, promptsCount: 1 },
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SkillCard
          skill={skill}
          onDelete={onDelete}
          providers={providers}
          toolsCount={counts.toolsCount}
          promptsCount={counts.promptsCount}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SkillCard", () => {
  beforeEach(() => {
    socketStore.setState({
      appConfig: null,
      serializedAppConfig: null,
      systemState: null,
    });
  });

  it("navigates to the detail page when the card is clicked", () => {
    navigate.mockClear();
    renderCard();
    fireEvent.click(screen.getByText("review-pull-requests"));
    expect(navigate).toHaveBeenCalledWith(
      "/skills/0190a000-0000-7000-8000-000000000001",
    );
  });

  it("navigates to the editor from the Edit action", () => {
    navigate.mockClear();
    renderCard();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Open skill actions for review-pull-requests",
      }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(navigate).toHaveBeenCalledWith(
      "/skills/0190a000-0000-7000-8000-000000000001/edit",
    );
  });

  it("deletes via the delete action after confirming", async () => {
    navigate.mockClear();
    const onDelete = vi.fn();
    renderCard(onDelete);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Open skill actions for review-pull-requests",
      }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Delete skill" }),
    );

    expect(onDelete).toHaveBeenCalledWith(skill.id);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("downloads the full skill Markdown from the actions menu", async () => {
    navigate.mockClear();
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:skill");
    const revokeObjectURL = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    const click = vi.fn();
    const appendChild = vi.spyOn(document.body, "appendChild");
    const removeChild = vi.spyOn(document.body, "removeChild");
    const createElement = vi.spyOn(document, "createElement");

    try {
      createElement.mockImplementation((tagName, options) => {
        const element = Document.prototype.createElement.call(
          document,
          tagName,
          options,
        );
        if (tagName.toLowerCase() === "a") {
          element.click = click;
        }
        return element;
      });

      renderCard();
      fireEvent.click(
        screen.getByRole("button", {
          name: "Open skill actions for review-pull-requests",
        }),
      );
      fireEvent.click(screen.getByRole("menuitem", { name: "Download" }));

      expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
      expect(appendChild).toHaveBeenCalledWith(expect.any(HTMLAnchorElement));
      expect(click).toHaveBeenCalledTimes(1);
      expect(removeChild).toHaveBeenCalledWith(expect.any(HTMLAnchorElement));
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:skill");

      const anchor = appendChild.mock.calls.find(
        ([node]) => node instanceof HTMLAnchorElement,
      )?.[0] as HTMLAnchorElement | undefined;
      expect(anchor?.download).toBe("SKILL.md");
      expect(anchor?.href).toBe("blob:skill");

      const blob = createObjectURL.mock.calls[0]?.[0] as Blob;
      expect(blob.type).toBe("text/markdown;charset=utf-8");
      await expect(blob.text()).resolves.toBe(
        [
          "---",
          'name: "review-pull-requests"',
          'description: "Review repository changes."',
          "---",
          "",
          "# Review",
          "",
        ].join("\n"),
      );
    } finally {
      createObjectURL.mockRestore();
      revokeObjectURL.mockRestore();
      appendChild.mockRestore();
      removeChild.mockRestore();
      createElement.mockRestore();
    }
  });

  it("does not render hover-only edit and delete buttons", () => {
    renderCard();

    expect(
      screen.queryByRole("button", { name: "Edit review-pull-requests" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete review-pull-requests" }),
    ).not.toBeInTheDocument();
  });

  it("renders the author as a card subtitle", () => {
    renderCard();

    expect(screen.getByText("by Amir")).toBeInTheDocument();
  });

  it("does not render prompt or resource badges in the footer", () => {
    renderCard();

    expect(screen.queryByText("Slash command")).not.toBeInTheDocument();
    expect(screen.queryByText("Resource only")).not.toBeInTheDocument();
  });

  it("renders an MCP servers section with one badge per provider", () => {
    renderCard(vi.fn(), ["github", "linear"]);

    expect(screen.getByText("MCP Servers")).toBeInTheDocument();
    expect(screen.getByText("github")).toBeInTheDocument();
    expect(screen.getByText("linear")).toBeInTheDocument();
  });

  it("does not render tool counts inside MCP server badges", () => {
    renderCard(vi.fn(), ["github"]);

    expect(screen.getByText("github")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("renders skill metrics for tools and prompts, without resources yet", () => {
    renderCard();

    expect(screen.getByLabelText("Tools: 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Prompts: 1")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Resources:/)).not.toBeInTheDocument();
  });

  it("renders only five MCP server badges plus hidden-count text", () => {
    renderCard(vi.fn(), [
      "github",
      "linear",
      "slack",
      "calculator",
      "filesystem",
      "datadog",
      "postgres",
    ]);

    expect(screen.getByText("github")).toBeInTheDocument();
    expect(screen.getByText("linear")).toBeInTheDocument();
    expect(screen.getByText("slack")).toBeInTheDocument();
    expect(screen.getByText("calculator")).toBeInTheDocument();
    expect(screen.getByText("filesystem")).toBeInTheDocument();
    expect(screen.getByText("+2")).toHaveClass("shrink-0");
    expect(screen.queryByText("datadog")).not.toBeInTheDocument();
    expect(screen.queryByText("postgres")).not.toBeInTheDocument();
  });

  it("keeps missing or inactive MCP server badges visible past the active badge limit", () => {
    socketStore.setState({
      systemState: {
        targetServers: [
          targetServer("github"),
          targetServer("linear"),
          targetServer("slack"),
          targetServer("calculator"),
          targetServer("filesystem"),
          targetServer("datadog"),
          targetServer("postgres"),
        ],
        connectedClients: [],
        connectedClientClusters: [],
        usage: { callCount: 0 },
        lastUpdatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      appConfig: {
        permissions: {
          default: { _type: "default-block", allow: [] },
          consumers: {},
          clientNames: {},
        },
        toolGroups: [],
        auth: { enabled: false },
        toolExtensions: { services: {} },
        targetServerAttributes: { datadog: { inactive: true } },
        skills: { enabled: [] },
        staticOauth: undefined,
      },
    });

    renderCard(vi.fn(), [
      "github",
      "linear",
      "slack",
      "calculator",
      "filesystem",
      "datadog",
      "postgres",
    ]);

    expect(screen.getByText("datadog")).toBeInTheDocument();
    expect(screen.getByText("+1")).toBeInTheDocument();
    expect(screen.queryByText("postgres")).not.toBeInTheDocument();
  });

  it("renders an MCP servers empty state when there are no providers", () => {
    renderCard();

    expect(screen.getByText("MCP Servers")).toBeInTheDocument();
    expect(screen.getByText("No capabilities linked yet")).toBeInTheDocument();
  });
});

function targetServer(name: string) {
  return {
    _type: "stdio" as const,
    name,
    command: "npx",
    state: { type: "connected" as const },
    tools: [],
    originalTools: [],
    usage: { callCount: 0 },
  };
}
