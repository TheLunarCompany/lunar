import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDeleteSkill, useSkill } from "@/data/skills";
import SkillDetail from "./SkillDetail";

vi.mock("@/data/skills", () => ({
  useSkill: vi.fn(),
  useDeleteSkill: vi.fn(),
}));
vi.mock("@/components/ui/use-toast", () => ({ toast: vi.fn() }));

const idleMutation = { mutateAsync: vi.fn(), isPending: false };

describe("SkillDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDeleteSkill).mockReturnValue(idleMutation as never);
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

    render(
      <MemoryRouter
        initialEntries={[
          "/skills/0190a000-0000-7000-8000-000000000001#skill-instructions",
        ]}
      >
        <Routes>
          <Route path="/skills/:id" element={<SkillDetail />} />
        </Routes>
      </MemoryRouter>,
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
    render(
      <MemoryRouter
        initialEntries={["/skills/0190a000-0000-7000-8000-000000000001"]}
      >
        <Routes>
          <Route path="/skills/:id" element={<SkillDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Skills" })).toHaveAttribute(
      "href",
      "/skills",
    );
    expect(
      screen.getByRole("heading", { name: "existing", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Existing description")).toBeInTheDocument();
    expect(screen.getByText("Maintained by")).toBeInTheDocument();
    expect(screen.getByText("Amir")).toBeInTheDocument();
    expect(screen.queryByText("Overview")).not.toBeInTheDocument();
    expect(screen.queryByText("MCP Servers")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "SKILL.md" })).toHaveAttribute(
      "href",
      "#skill-instructions",
    );
    expect(screen.getByRole("link", { name: "Linked MCP" })).toHaveAttribute(
      "href",
      "#linked-mcp-capabilities",
    );
    expect(
      screen.queryByRole("link", { name: "Applied to agents" }),
    ).not.toBeInTheDocument();
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
});
