import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SkillEditor from "./SkillEditor";
import { useCreateSkill, useSkill, useUpdateSkill } from "@/data/skills";

vi.mock("@/data/skills", () => ({
  useSkill: vi.fn(),
  useCreateSkill: vi.fn(),
  useUpdateSkill: vi.fn(),
}));
vi.mock("@/components/ui/use-toast", () => ({ toast: vi.fn() }));

const idleMutation = { mutateAsync: vi.fn(), isPending: false };

describe("SkillEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCreateSkill).mockReturnValue(idleMutation as never);
    vi.mocked(useUpdateSkill).mockReturnValue(idleMutation as never);
    vi.mocked(useSkill).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    } as never);
  });

  it("renders the create form on /skills/new/blank", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/skills/new/blank"]}>
        <Routes>
          <Route path="/skills/new/blank" element={<SkillEditor />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(
      container.querySelector('[data-slot="skill-page-root"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector(
        '[data-slot="skill-page-container"][data-size="form"]',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create skill" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Add a new skill" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Back to skills" }),
    ).toBeInTheDocument();
  });

  it("prefills the upload editor from navigation state", () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/skills/new/upload",
            state: {
              draft: {
                name: "imported-skill",
                description: "Imported description",
                body: "# Imported",
                exposeAsPrompt: true,
              },
            },
          },
        ]}
      >
        <Routes>
          <Route path="/skills/new/upload" element={<SkillEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByLabelText("Name")).toHaveValue("imported-skill");
    expect(screen.getByLabelText("Description")).toHaveValue(
      "Imported description",
    );
    expect(screen.getByLabelText("Markdown body")).toHaveValue("# Imported");
  });

  it("renders the edit form prefilled on /skills/:id", () => {
    vi.mocked(useSkill).mockReturnValue({
      data: {
        id: "0190a000-0000-7000-8000-000000000001",
        name: "existing",
        description: "desc",
        body: "# Existing",
        exposeAsPrompt: true,
        author: { setupOwnerId: "o", displayName: "Amir" },
        updatedAt: new Date("2026-06-29T10:00:00.000Z"),
      },
      isLoading: false,
      isError: false,
    } as never);

    render(
      <MemoryRouter
        initialEntries={["/skills/0190a000-0000-7000-8000-000000000001"]}
      >
        <Routes>
          <Route path="/skills/:id" element={<SkillEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByLabelText("Name")).toHaveValue("existing");
    expect(
      screen.getByRole("button", { name: "Save changes" }),
    ).toBeInTheDocument();
  });
});
