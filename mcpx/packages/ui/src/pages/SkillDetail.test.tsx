import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGetMCPServers } from "@/data/catalog-servers";
import { useDeleteSkill, useEnabledSkills, useSkill } from "@/data/skills";
import { toast } from "@/components/ui/use-toast";
import SkillDetail from "./SkillDetail";

vi.mock("@/data/skills", () => ({
  useSkill: vi.fn(),
  useDeleteSkill: vi.fn(),
  useEnabledSkills: vi.fn(),
}));
vi.mock("@/data/catalog-servers", () => ({ useGetMCPServers: vi.fn() }));
vi.mock("@/components/ui/use-toast", () => ({ toast: vi.fn() }));

const idleMutation = { mutateAsync: vi.fn(), isPending: false };

describe("SkillDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDeleteSkill).mockReturnValue(idleMutation as never);
    vi.mocked(useEnabledSkills).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as never);
    vi.mocked(useGetMCPServers).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as never);
    vi.mocked(useSkill).mockReturnValue({
      data: {
        id: "0190a000-0000-7000-8000-000000000001",
        name: "existing",
        description: "Existing description",
        body: "# Existing instructions",
        exposeAsPrompt: true,
        author: { setupOwnerId: "o", displayName: "Amir" },
        updatedAt: new Date("2026-06-29T10:00:00.000Z"),
      },
      isLoading: false,
      isError: false,
    } as never);
  });

  function renderSkillDetail(initialEntry: string) {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/skills/:id" element={<SkillDetail />} />
            <Route
              path="/skills/:id/capabilities"
              element={<div>Capabilities editor route</div>}
            />
            <Route
              path="/skills/:id/agents"
              element={<div>Skill agents editor route</div>}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it("scrolls to a hash anchor after the skill content renders", async () => {
    const scrollIntoView = vi.fn();
    const requestAnimationFrame = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        callback(0);
        return 0;
      });
    const getElementById = vi
      .spyOn(document, "getElementById")
      .mockReturnValue({
        scrollIntoView,
      } as unknown as HTMLElement);

    renderSkillDetail(
      "/skills/0190a000-0000-7000-8000-000000000001#skill-instructions",
    );

    await waitFor(() => {
      expect(document.getElementById).toHaveBeenCalledWith(
        "skill-instructions",
      );
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });
    });

    requestAnimationFrame.mockRestore();
    getElementById.mockRestore();
  });

  it("renders the read-only skill detail page on /skills/:id", () => {
    renderSkillDetail("/skills/0190a000-0000-7000-8000-000000000001");

    const breadcrumbs = screen.getByRole("navigation", {
      name: "Breadcrumb",
    });
    expect(
      screen.getByRole("link", { name: "Back to Skills" }),
    ).toHaveAttribute("href", "/skills");
    expect(
      within(breadcrumbs).getByRole("link", { name: "Skills" }),
    ).toHaveAttribute("href", "/skills");
    expect(within(breadcrumbs).getByText("existing")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("heading", { name: "existing", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Existing description")).toBeInTheDocument();
    expect(screen.getByText("Maintained by")).toBeInTheDocument();
    expect(screen.getByText("Amir")).toBeInTheDocument();
    expect(screen.queryByText("Overview")).not.toBeInTheDocument();
    expect(screen.queryByText("MCP Servers")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Skill page sections" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Applied to agents" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Skill" })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "MCP capabilities" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Applied to agents" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Existing instructions",
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete skill" }),
    ).toBeInTheDocument();
  });

  it("renders Applied to agents read-only and navigates to its editor", async () => {
    const user = userEvent.setup();
    const skillId = "0190a000-0000-7000-8000-000000000001";
    const subject = { kind: "consumerTag" as const, value: "engineering" };
    vi.mocked(useEnabledSkills).mockReturnValue({
      data: [{ subject, skillIds: [skillId] }],
      isLoading: false,
      isError: false,
    } as never);

    renderSkillDetail(`/skills/${skillId}`);
    await user.click(screen.getByRole("tab", { name: "Applied to agents" }));

    expect(screen.getByText("engineering")).toBeInTheDocument();
    expect(screen.getByText("Not currently connected")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByText("Skill agents editor route")).toBeInTheDocument();
  });

  it("shows linked MCP capabilities in the MCP capabilities tab", async () => {
    const user = userEvent.setup();
    vi.mocked(useGetMCPServers).mockReturnValue({
      data: [
        {
          id: "0190a000-0000-7000-8000-000000000010",
          name: "browser",
          displayName: "Browser",
          description: undefined,
          config: {},
        },
      ],
      isLoading: false,
      isError: false,
    } as never);
    vi.mocked(useSkill).mockReturnValue({
      data: {
        id: "0190a000-0000-7000-8000-000000000001",
        name: "existing",
        description: "Existing description",
        body: "# Existing instructions",
        exposeAsPrompt: true,
        author: { setupOwnerId: "o", displayName: "Amir" },
        capabilityGroup: {
          items: [
            {
              catalogItemId: "0190a000-0000-7000-8000-000000000010",
              tools: ["browser_open"],
              prompts: [],
            },
          ],
        },
        updatedAt: new Date("2026-06-29T10:00:00.000Z"),
      },
      isLoading: false,
      isError: false,
    } as never);

    renderSkillDetail("/skills/0190a000-0000-7000-8000-000000000001");

    await user.click(screen.getByRole("tab", { name: "MCP capabilities" }));

    await waitFor(() => {
      expect(screen.getByText("Linked MCP capabilities")).toBeInTheDocument();
      expect(screen.getByText("Browser")).toBeInTheDocument();
    });
  });

  it("opens the MCP capabilities editor from the MCP capabilities tab", async () => {
    const user = userEvent.setup();

    renderSkillDetail("/skills/0190a000-0000-7000-8000-000000000001");

    await user.click(screen.getByRole("tab", { name: "MCP capabilities" }));
    await user.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByText("Capabilities editor route")).toBeInTheDocument();
  });

  it("keeps the delete confirmation open when deletion fails", async () => {
    vi.mocked(useDeleteSkill).mockReturnValue({
      mutateAsync: vi.fn().mockRejectedValue(new Error("Permission denied")),
      isPending: false,
    } as never);

    renderSkillDetail("/skills/0190a000-0000-7000-8000-000000000001");

    fireEvent.click(screen.getByRole("button", { name: "Delete skill" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete skill" }),
    );

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Failed to delete skill",
          description: "Permission denied",
          variant: "destructive",
        }),
      );
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByText("This permanently deletes existing."),
    ).toBeInTheDocument();
  });
});
