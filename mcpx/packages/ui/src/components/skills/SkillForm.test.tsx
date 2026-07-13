import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SkillForm } from "./SkillForm";

vi.mock("@/hooks/useDomainIcon", () => ({
  useDomainIcon: () => undefined,
}));

describe("SkillForm", () => {
  it("submits a draft built from the fields", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<SkillForm submitLabel="Create skill" onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Skill name"), {
      target: { value: "my-skill" },
    });
    fireEvent.change(screen.getByLabelText("Short description"), {
      target: { value: "Does a thing" },
    });
    fireEvent.change(screen.getByLabelText("Markdown body"), {
      target: { value: "# My skill" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create skill" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      name: "my-skill",
      description: "Does a thing",
      body: "# My skill",
      exposeAsPrompt: true,
    });
  });

  it("submits exposeAsPrompt false when the slash command switch is disabled", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<SkillForm submitLabel="Create skill" onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Skill name"), {
      target: { value: "my-skill" },
    });
    fireEvent.change(screen.getByLabelText("Short description"), {
      target: { value: "Does a thing" },
    });
    fireEvent.change(screen.getByLabelText("Markdown body"), {
      target: { value: "# My skill" },
    });
    await user.click(screen.getByRole("switch", { name: "Expose as prompt" }));
    await user.click(screen.getByRole("button", { name: "Create skill" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      name: "my-skill",
      description: "Does a thing",
      body: "# My skill",
      exposeAsPrompt: false,
    });
  });

  it("shows validation errors and does not submit when empty", async () => {
    const onSubmit = vi.fn();
    render(<SkillForm submitLabel="Create skill" onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: "Create skill" }));

    expect(await screen.findByText("Name is required.")).toBeInTheDocument();
    expect(screen.getByLabelText("Markdown body")).toHaveAttribute(
      "aria-invalid",
      "false",
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits when the markdown body is empty", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<SkillForm submitLabel="Create skill" onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Skill name"), {
      target: { value: "empty-body" },
    });
    fireEvent.change(screen.getByLabelText("Short description"), {
      target: { value: "Creates a skill without instructions yet." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create skill" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      name: "empty-body",
      description: "Creates a skill without instructions yet.",
      body: "",
      exposeAsPrompt: true,
    });
  });

  it("focuses the first invalid field after validation fails", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<SkillForm submitLabel="Create skill" onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "Create skill" }));

    expect(await screen.findByText("Name is required.")).toBeInTheDocument();
    expect(screen.getByLabelText("Skill name")).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows validation errors for invalid name and overlong description", async () => {
    const onSubmit = vi.fn();
    render(<SkillForm submitLabel="Create skill" onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Skill name"), {
      target: { value: "Invalid name" },
    });
    fireEvent.change(screen.getByLabelText("Short description"), {
      target: { value: "a".repeat(1025) },
    });
    fireEvent.change(screen.getByLabelText("Markdown body"), {
      target: { value: "# Body" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create skill" }));

    const nameError = await screen.findByText(
      "Name must use lowercase letters, numbers, and hyphens only, and must not start or end with a hyphen or contain consecutive hyphens. Examples: pdf-processing, data-analysis, code-review.",
    );
    expect(nameError).toBeInTheDocument();
    expect(nameError).toHaveClass("text-destructive");
    expect(
      screen.getByText("Description must be 1024 characters or fewer."),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects a name that contains spaces", async () => {
    const onSubmit = vi.fn();
    render(<SkillForm submitLabel="Create skill" onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Skill name"), {
      target: { value: "name name" },
    });
    fireEvent.change(screen.getByLabelText("Short description"), {
      target: { value: "Describes when to use the skill." },
    });
    fireEvent.change(screen.getByLabelText("Markdown body"), {
      target: { value: "# Body" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create skill" }));

    expect(
      await screen.findByText(
        "Name must use lowercase letters, numbers, and hyphens only, and must not start or end with a hyphen or contain consecutive hyphens. Examples: pdf-processing, data-analysis, code-review.",
      ),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("prefills fields from defaultValues for editing", () => {
    render(
      <SkillForm
        submitLabel="Save changes"
        onSubmit={vi.fn()}
        defaultValues={{
          name: "existing",
          description: "Existing desc",
          body: "# Existing",
          exposeAsPrompt: true,
        }}
      />,
    );

    expect(screen.getByLabelText("Skill name")).toHaveValue("existing");
    expect(screen.getByLabelText("Short description")).toHaveValue(
      "Existing desc",
    );
    expect(screen.getByLabelText("Markdown body")).toHaveValue("# Existing");
    expect(
      screen.getByRole("switch", { name: "Expose as prompt" }),
    ).toBeChecked();
  });

  it("wraps skill metadata fields in one section", () => {
    render(<SkillForm submitLabel="Create skill" onSubmit={vi.fn()} />);

    const detailsSection = screen.getByRole("region", {
      name: "Skill details",
    });

    expect(
      within(detailsSection).getByLabelText("Skill name"),
    ).toBeInTheDocument();
    expect(
      within(detailsSection).getByLabelText("Short description"),
    ).toBeInTheDocument();
    expect(
      within(detailsSection).getByRole("switch", { name: "Expose as prompt" }),
    ).toBeInTheDocument();
  });

  it("renders the Markdown body inside the SKILL.md section card", () => {
    render(<SkillForm submitLabel="Create skill" onSubmit={vi.fn()} />);

    expect(
      screen.getByRole("heading", { name: "SKILL.md" }),
    ).toBeInTheDocument();
    expect(screen.getByText("single markdown file")).toBeInTheDocument();
    expect(
      screen.getByRole("tablist", { name: "Markdown body mode" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Preview",
      "Raw",
    ]);
    expect(screen.getByRole("tab", { name: "Raw" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByLabelText("Markdown body")).toBeInTheDocument();
  });

  it("preserves resource-only defaultValues for editing", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <SkillForm
        submitLabel="Save changes"
        onSubmit={onSubmit}
        defaultValues={{
          name: "resource-only",
          description: "Existing desc",
          body: "# Existing",
          exposeAsPrompt: false,
        }}
      />,
    );

    expect(
      screen.getByRole("switch", { name: "Expose as prompt" }),
    ).not.toBeChecked();

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      name: "resource-only",
      description: "Existing desc",
      body: "# Existing",
      exposeAsPrompt: false,
    });
  });

  it("previews the Markdown body and returns to raw editing", async () => {
    const user = userEvent.setup();
    render(
      <SkillForm
        submitLabel="Save changes"
        onSubmit={vi.fn()}
        defaultValues={{
          name: "Preview skill",
          description: "Existing desc",
          body: "# Preview title\n\nThis is **bold**.",
          exposeAsPrompt: true,
        }}
      />,
    );

    await user.click(screen.getByRole("tab", { name: "Preview" }));

    expect(
      screen.getByRole("heading", { name: "Preview title" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/This is/)).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Raw" }));

    expect(screen.getByLabelText("Markdown body")).toHaveValue(
      "# Preview title\n\nThis is **bold**.",
    );
  });

  it("does not render a Markdown upload input", () => {
    render(<SkillForm submitLabel="Create skill" onSubmit={vi.fn()} />);

    expect(
      screen.queryByLabelText("Upload Markdown skill"),
    ).not.toBeInTheDocument();
  });

  it("does not render tool group controls and ignores existing capabilityGroup values", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <SkillForm
        submitLabel="Save changes"
        onSubmit={onSubmit}
        defaultValues={{
          name: "existing",
          description: "Existing desc",
          body: "# Existing",
          exposeAsPrompt: true,
          capabilityGroup: {
            name: "Repo",
            items: [
              {
                catalogItemId: "0190a000-0000-7000-8000-000000000010",
                tools: "*",
                prompts: [],
              },
            ],
          },
        }}
      />,
    );

    expect(
      screen.queryByRole("combobox", { name: "Tool group" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Tool group JSON")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      name: "existing",
      description: "Existing desc",
      body: "# Existing",
      exposeAsPrompt: true,
    });
  });
});
