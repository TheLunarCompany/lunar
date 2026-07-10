import { fireEvent, render, screen } from "@testing-library/react";
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
    expect(
      screen.getByRole("button", { name: /Drag and drop your skill here/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Import from GitHub/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Start from blank/i }),
    ).toHaveAttribute("href", "/skills/new/blank");
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
