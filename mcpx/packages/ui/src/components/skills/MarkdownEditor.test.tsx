import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MarkdownEditor } from "./MarkdownEditor";

describe("MarkdownEditor", () => {
  it("renders markdown content in view mode", () => {
    const onEdit = vi.fn();

    render(
      <MarkdownEditor
        mode="view"
        value={"# Browser automation\n\nUse Playwright."}
        onEdit={onEdit}
      />,
    );

    expect(screen.getByText("SKILL.md")).toBeInTheDocument();
    expect(screen.getByText("Instructions")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Browser automation", level: 1 }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("renders an editable textarea in edit mode", () => {
    const onChange = vi.fn();

    render(
      <MarkdownEditor
        mode="edit"
        value="# Draft"
        onChange={onChange}
        textareaId="skill-body"
      />,
    );

    const textarea = screen.getByLabelText("Markdown body");
    expect(textarea).toHaveValue("# Draft");
    expect(
      screen.queryByRole("button", { name: "Edit" }),
    ).not.toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: "# Updated" } });
    expect(onChange).toHaveBeenCalledWith("# Updated");
  });
});
