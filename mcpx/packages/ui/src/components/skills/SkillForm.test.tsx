import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SkillForm } from "./SkillForm";

vi.mock("@/hooks/useDomainIcon", () => ({
  useDomainIcon: () => undefined,
}));

const githubCatalogItemId = "0190a000-0000-7000-8000-000000000010";
const linearCatalogItemId = "0190a000-0000-7000-8000-000000000011";

describe("SkillForm", () => {
  it("submits a draft built from the fields", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<SkillForm submitLabel="Create skill" onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "my-skill" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
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

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "my-skill" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
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
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows validation errors for invalid name and overlong description", async () => {
    const onSubmit = vi.fn();
    render(<SkillForm submitLabel="Create skill" onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Invalid name" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "a".repeat(1025) },
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
    expect(
      screen.getByText("Description must be 1024 characters or fewer."),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects a name that contains spaces", async () => {
    const onSubmit = vi.fn();
    render(<SkillForm submitLabel="Create skill" onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "name name" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
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

    expect(screen.getByLabelText("Name")).toHaveValue("existing");
    expect(screen.getByLabelText("Description")).toHaveValue("Existing desc");
    expect(screen.getByLabelText("Markdown body")).toHaveValue("# Existing");
    expect(
      screen.getByRole("switch", { name: "Expose as prompt" }),
    ).toBeChecked();
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

  it("does not render the tool group JSON field", () => {
    render(
      <SkillForm
        submitLabel="Save changes"
        onSubmit={vi.fn()}
        defaultValues={{
          name: "existing",
          description: "Existing desc",
          body: "# Existing",
          exposeAsPrompt: true,
          capabilityGroup: {
            name: "Repo",
            items: [
              {
                catalogItemId: githubCatalogItemId,
                tools: "*",
                prompts: [],
              },
            ],
          },
        }}
      />,
    );

    expect(screen.queryByLabelText("Tool group JSON")).not.toBeInTheDocument();
  });

  it("submits the selected tool group option", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <SkillForm
        submitLabel="Create skill"
        onSubmit={onSubmit}
        toolGroupOptions={[
          {
            id: "repo",
            name: "Repository tools",
            description: "GitHub access",
            capabilityGroup: {
              name: "Repository tools",
              items: [
                {
                  catalogItemId: githubCatalogItemId,
                  tools: ["pull_request_read"],
                  prompts: [],
                },
              ],
            },
          },
        ]}
      />,
    );

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "review-pull-requests" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Reviews pull request changes" },
    });
    fireEvent.change(screen.getByLabelText("Markdown body"), {
      target: { value: "# Review" },
    });

    await user.click(screen.getByRole("combobox", { name: "Tool group" }));
    await user.click(screen.getByRole("option", { name: /Repository tools/i }));
    await user.click(screen.getByRole("button", { name: "Create skill" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      name: "review-pull-requests",
      description: "Reviews pull request changes",
      body: "# Review",
      exposeAsPrompt: true,
      capabilityGroup: {
        name: "Repository tools",
        items: [
          {
            catalogItemId: githubCatalogItemId,
            tools: ["pull_request_read"],
            prompts: [],
          },
        ],
      },
    });
  });

  it("filters tool group options while typing in the combobox", async () => {
    const user = userEvent.setup();
    render(
      <SkillForm
        submitLabel="Create skill"
        onSubmit={vi.fn()}
        toolGroupOptions={[
          {
            id: "github",
            name: "GitHub Triage",
            capabilityGroup: {
              name: "GitHub Triage",
              items: [
                {
                  catalogItemId: githubCatalogItemId,
                  tools: "*",
                  prompts: [],
                },
              ],
            },
          },
          {
            id: "linear",
            name: "Linear Reporting",
            capabilityGroup: {
              name: "Linear Reporting",
              items: [
                {
                  catalogItemId: linearCatalogItemId,
                  tools: "*",
                  prompts: [],
                },
              ],
            },
          },
        ]}
      />,
    );

    const combobox = screen.getByRole("combobox", { name: "Tool group" });
    await user.click(combobox);
    await user.type(combobox, "git");

    expect(
      screen.getByRole("option", { name: /GitHub Triage/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /Linear Reporting/i }),
    ).not.toBeInTheDocument();
  });

  it("filters tool group options by provider names", async () => {
    const user = userEvent.setup();
    render(
      <SkillForm
        submitLabel="Create skill"
        onSubmit={vi.fn()}
        toolGroupOptions={[
          {
            id: "triage",
            name: "Triage",
            capabilityGroup: {
              name: "Triage",
              items: [
                {
                  catalogItemId: githubCatalogItemId,
                  tools: "*",
                  prompts: [],
                },
              ],
            },
            providers: [{ providerName: "github", itemCount: 4 }],
          },
          {
            id: "reporting",
            name: "Reporting",
            capabilityGroup: {
              name: "Reporting",
              items: [
                {
                  catalogItemId: linearCatalogItemId,
                  tools: "*",
                  prompts: [],
                },
              ],
            },
            providers: [{ providerName: "linear", itemCount: 8 }],
          },
        ]}
      />,
    );

    const combobox = screen.getByRole("combobox", { name: "Tool group" });
    await user.click(combobox);
    await user.type(combobox, "github");

    expect(screen.getByRole("option", { name: /Triage/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /Reporting/i }),
    ).not.toBeInTheDocument();
  });

  it("shows provider badges inside tool group dropdown options", async () => {
    const user = userEvent.setup();
    render(
      <SkillForm
        submitLabel="Create skill"
        onSubmit={vi.fn()}
        toolGroupOptions={[
          {
            id: "triage",
            name: "Triage",
            capabilityGroup: {
              name: "Triage",
              items: [
                {
                  catalogItemId: githubCatalogItemId,
                  tools: "*",
                  prompts: [],
                },
              ],
            },
            providers: [{ providerName: "github", itemCount: 4 }],
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Tool group" }));

    expect(screen.getByRole("option", { name: /github/i })).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("opens the tool group dropdown on focus without showing a no-group option", () => {
    render(
      <SkillForm
        submitLabel="Create skill"
        onSubmit={vi.fn()}
        toolGroupOptions={[
          {
            id: "triage",
            name: "Triage",
            capabilityGroup: {
              name: "Triage",
              items: [
                {
                  catalogItemId: githubCatalogItemId,
                  tools: "*",
                  prompts: [],
                },
              ],
            },
          },
        ]}
      />,
    );

    fireEvent.focus(screen.getByRole("combobox", { name: "Tool group" }));

    expect(screen.getByRole("option", { name: "Triage" })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "No tool group" }),
    ).not.toBeInTheDocument();
  });

  it("shows provider badges for the selected tool group", () => {
    render(
      <SkillForm
        submitLabel="Create skill"
        onSubmit={vi.fn()}
        defaultValues={{
          name: "review-pull-requests",
          description: "Reviews pull request changes",
          body: "# Review",
          exposeAsPrompt: true,
          capabilityGroup: {
            name: "Repository tools",
            items: [
              {
                catalogItemId: githubCatalogItemId,
                tools: ["pull_request_read", "issues_read"],
                prompts: [],
              },
              {
                catalogItemId: linearCatalogItemId,
                tools: "*",
                prompts: [],
              },
            ],
          },
        }}
        toolGroupOptions={[
          {
            id: "repo",
            name: "Repository tools",
            capabilityGroup: {
              name: "Repository tools",
              items: [
                {
                  catalogItemId: githubCatalogItemId,
                  tools: ["pull_request_read", "issues_read"],
                  prompts: [],
                },
                {
                  catalogItemId: linearCatalogItemId,
                  tools: "*",
                  prompts: [],
                },
              ],
            },
            providers: [
              { providerName: "github", itemCount: 2 },
              { providerName: "linear", itemCount: 8 },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText("github")).toBeInTheDocument();
    expect(screen.getByText("linear")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
  });
});
