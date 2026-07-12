import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SkillCreateStart from "./SkillCreateStart";
vi.mock("@/components/ui/use-toast", () => ({ toast: vi.fn() }));

describe("SkillCreateStart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("offers file upload and blank skill entry points", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/skills/new"]}>
        <Routes>
          <Route path="/skills/new" element={<SkillCreateStart />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      container.querySelector('[data-slot="skill-page-root"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector(
        '[data-slot="skill-page-container"][data-size="wide"]',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Add a new skill" }),
    ).toBeInTheDocument();
    const breadcrumbs = screen.getByRole("navigation", {
      name: "Breadcrumb",
    });
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(
      screen.queryByRole("link", { name: /^Back to / }),
    ).not.toBeInTheDocument();
    expect(
      within(breadcrumbs).getByRole("link", { name: "Skills" }),
    ).toHaveAttribute("href", "/skills");
    expect(within(breadcrumbs).getByText("Add new")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.queryByRole("button", { name: "Back to skills" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Drag and drop your skill here/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("max 10 MB")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Write a SKILL.md manifest from scratch in the editor, including name, description, and instructions.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Import from GitHub/i }),
    ).not.toBeInTheDocument();
    const blankLink = screen.getByRole("link", { name: /Start from blank/i });
    expect(blankLink).toHaveAttribute("href", "/skills/new/blank");
    expect(blankLink).toHaveClass("flex-col", "items-center", "text-center");
  });

  it("opens the file picker when upload is clicked", () => {
    const clickFileInput = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => {});

    try {
      render(
        <MemoryRouter initialEntries={["/skills/new"]}>
          <Routes>
            <Route path="/skills/new" element={<SkillCreateStart />} />
          </Routes>
        </MemoryRouter>,
      );

      fireEvent.click(screen.getByRole("button", { name: /browse files/i }));

      expect(clickFileInput).toHaveBeenCalled();
    } finally {
      clickFileInput.mockRestore();
    }
  });

  it("parses a selected Markdown file in the browser before navigating to the upload editor", async () => {
    render(
      <MemoryRouter initialEntries={["/skills/new"]}>
        <Routes>
          <Route path="/skills/new" element={<SkillCreateStart />} />
          <Route
            path="/skills/new/upload"
            element={<div>Upload editor opened</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    const input = screen.getByLabelText("Upload skill file");
    fireEvent.change(input, {
      target: {
        files: [
          new File(
            [
              [
                "---",
                "name: imported-skill",
                "description: Imported description",
                "---",
                "# Imported",
              ].join("\n"),
            ],
            "SKILL.md",
            {
              type: "text/markdown",
            },
          ),
        ],
      },
    });

    expect(await screen.findByText("Upload editor opened")).toBeInTheDocument();
  });

  it("parses a dropped Markdown file in the browser before navigating to the upload editor", async () => {
    render(
      <MemoryRouter initialEntries={["/skills/new"]}>
        <Routes>
          <Route path="/skills/new" element={<SkillCreateStart />} />
          <Route
            path="/skills/new/upload"
            element={<div>Upload editor opened</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.drop(
      screen.getByRole("button", { name: /Drag and drop your skill here/i }),
      {
        dataTransfer: {
          files: [
            new File(["# Dropped"], "SKILL.md", {
              type: "text/markdown",
            }),
          ],
        },
      },
    );

    expect(await screen.findByText("Upload editor opened")).toBeInTheDocument();
  });
});
