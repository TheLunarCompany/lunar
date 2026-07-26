import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CapabilityProvider } from "@/components/capabilities/types";
import { buildSkillCapabilitySelectionKey } from "@/mapping/skill-capabilities";

import { SkillCapabilityPicker } from "./SkillCapabilityPicker";

vi.mock("@/hooks/useDomainIcon", () => ({
  useDomainIcon: (name: string) => `https://icons.example/${name}.svg`,
}));

const githubCatalogItemId = "github-catalog-item";
const playwrightCatalogItemId = "playwright-catalog-item";
const githubSearchKey = buildSkillCapabilitySelectionKey(
  githubCatalogItemId,
  "tool",
  "search_repositories",
);
const githubDeleteKey = buildSkillCapabilitySelectionKey(
  githubCatalogItemId,
  "tool",
  "delete_repository",
);
const githubSharedToolKey = buildSkillCapabilitySelectionKey(
  githubCatalogItemId,
  "tool",
  "shared_name",
);
const githubSharedPromptKey = buildSkillCapabilitySelectionKey(
  githubCatalogItemId,
  "prompt",
  "shared_name",
);
const githubLongToolKey = buildSkillCapabilitySelectionKey(
  githubCatalogItemId,
  "tool",
  "long_description_tool",
);
const githubWritePullRequestKey = buildSkillCapabilitySelectionKey(
  githubCatalogItemId,
  "prompt",
  "write_pull_request",
);
const playwrightScreenshotKey = buildSkillCapabilitySelectionKey(
  playwrightCatalogItemId,
  "tool",
  "take_screenshot",
);
const githubSelectionKeys = [
  githubSearchKey,
  githubDeleteKey,
  githubSharedToolKey,
  githubSharedPromptKey,
  githubWritePullRequestKey,
  githubLongToolKey,
];
const longDescription =
  "This tool has a long operational description that explains prerequisites, expected arguments, selection rules, fallback behavior, examples, and edge cases. It is useful when inspecting the tool, but it should not make the entire provider section hard to scan by default.";
const fittingLongDescription =
  "Add a manual time entry to a task. You can provide either start plus duration or start plus end. The tool will calculate missing values. Requires task_id, start time, and either duration or end time. Supports description, billable flag, and tags.";

const providers: CapabilityProvider[] = [
  {
    name: "github",
    catalogItemId: githubCatalogItemId,
    items: [
      {
        id: "github:search_repositories",
        kind: "tool",
        name: "search_repositories",
        description: "Find repositories by owner and topic",
        providerName: "github",
        annotations: { readOnlyHint: true },
      },
      {
        id: "github:delete_repository",
        kind: "tool",
        name: "delete_repository",
        description: "Delete a repository",
        providerName: "github",
        annotations: { destructiveHint: true },
      },
      {
        id: "github:shared_name_tool",
        kind: "tool",
        name: "shared_name",
        description: "Shared name tool",
        providerName: "github",
      },
      {
        id: "github:shared_name_prompt",
        kind: "prompt",
        name: "shared_name",
        description: "Shared name prompt",
        providerName: "github",
      },
      {
        id: "github:write_pull_request",
        kind: "prompt",
        name: "write_pull_request",
        description: "Draft a pull request summary",
        providerName: "github",
      },
      {
        id: "github:long_description_tool",
        kind: "tool",
        name: "long_description_tool",
        description: longDescription,
        providerName: "github",
      },
    ],
  },
  {
    name: "playwright",
    catalogItemId: playwrightCatalogItemId,
    items: [
      {
        id: "playwright:take_screenshot",
        kind: "tool",
        name: "take_screenshot",
        description: "Capture a browser screenshot",
        providerName: "playwright",
      },
    ],
  },
];

function renderPicker(
  props: Partial<React.ComponentProps<typeof SkillCapabilityPicker>> = {},
) {
  return render(
    <SkillCapabilityPicker
      providers={providers}
      selectedKeys={new Set()}
      onSelectedKeysChange={vi.fn()}
      {...props}
    />,
  );
}

describe("SkillCapabilityPicker", () => {
  it("renders provider headers, counts, sections, item details, and annotation badges", async () => {
    const user = userEvent.setup();
    renderPicker({ selectedKeys: new Set([githubSearchKey]) });

    expect(
      screen.getByRole("searchbox", {
        name: "Search MCP tools and prompts",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /github 1 of 6 selected/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /playwright 0 of 1 selected/i }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("skill-capability-provider-github"))
        .getByTestId("skill-capability-provider-icon-github")
        .querySelector("img"),
    ).toHaveAttribute("src", "https://icons.example/github.svg");
    expect(
      within(screen.getByTestId("skill-capability-provider-playwright"))
        .getByTestId("skill-capability-provider-icon-playwright")
        .querySelector("img"),
    ).toHaveAttribute("src", "https://icons.example/playwright.svg");

    await user.click(
      screen.getByRole("button", { name: /playwright 0 of 1 selected/i }),
    );

    expect(
      screen.getAllByRole("heading", { name: "TOOLS" }).length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByRole("heading", { name: "PROMPTS" }),
    ).toBeInTheDocument();

    const githubSection = screen.getByTestId(
      "skill-capability-provider-github",
    );
    expect(
      within(githubSection).getByRole("checkbox", {
        name: /search_repositories/i,
      }),
    ).toBeChecked();
    expect(
      within(githubSection).getByText("search_repositories"),
    ).toBeVisible();
    expect(
      within(githubSection).getByText("Find repositories by owner and topic"),
    ).toBeVisible();
    expect(within(githubSection).getByText("READ ONLY")).toBeVisible();
    expect(within(githubSection).getByText("DESTRUCTIVE")).toBeVisible();
    expect(within(githubSection).getByText("write_pull_request")).toBeVisible();
  });

  it("keeps long descriptions compact until expanded", async () => {
    const user = userEvent.setup();
    renderPicker({ selectedKeys: new Set([githubLongToolKey]) });

    const description = screen.getByText(longDescription);
    expect(description).toHaveClass("line-clamp-3");

    const toggle = screen.getByRole("button", {
      name: /show more description for long_description_tool/i,
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);

    expect(description).not.toHaveClass("line-clamp-3");
    expect(toggle).toHaveTextContent("Show less");
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    await user.click(toggle);

    expect(description).toHaveClass("line-clamp-3");
    expect(toggle).toHaveTextContent("Show more");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("does not show description toggles for borderline descriptions", () => {
    const fittingToolKey = buildSkillCapabilitySelectionKey(
      githubCatalogItemId,
      "tool",
      "fitting_long_description_tool",
    );

    renderPicker({
      providers: [
        {
          name: "github",
          catalogItemId: githubCatalogItemId,
          items: [
            {
              id: "github:fitting_long_description_tool",
              kind: "tool",
              name: "fitting_long_description_tool",
              description: fittingLongDescription,
              providerName: "github",
            },
          ],
        },
      ],
      selectedKeys: new Set([fittingToolKey]),
    });

    expect(screen.getByText(fittingLongDescription)).toBeVisible();
    expect(
      screen.queryByRole("button", {
        name: /show more description for fitting_long_description_tool/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("collapses expanded provider content when the provider header is clicked again", async () => {
    const user = userEvent.setup();
    renderPicker({ selectedKeys: new Set([githubSearchKey]) });

    expect(screen.getByText("search_repositories")).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: /github 1 of 6 selected/i }),
    );

    expect(screen.queryByText("search_repositories")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Find repositories by owner and topic"),
    ).not.toBeInTheDocument();
  });

  it("collapses provider content while MCP server filters are applied", async () => {
    const user = userEvent.setup();
    renderPicker({ providerFilters: ["github"] });

    const providerToggle = screen.getByRole("button", {
      name: /github 0 of 6 selected/i,
    });
    expect(providerToggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("search_repositories")).toBeVisible();

    await user.click(providerToggle);

    expect(providerToggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("search_repositories")).not.toBeInTheDocument();
  });

  it("collapses provider content while searching", async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.type(
      screen.getByRole("searchbox", {
        name: "Search MCP tools and prompts",
      }),
      "github",
    );

    const providerToggle = screen.getByRole("button", {
      name: /github 0 of 6 selected/i,
    });
    expect(providerToggle).toHaveAttribute("aria-expanded", "true");

    await user.click(providerToggle);

    expect(providerToggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("search_repositories")).not.toBeInTheDocument();
  });

  it("re-expands collapsed provider content when the search criteria changes", async () => {
    const user = userEvent.setup();
    renderPicker();
    const search = screen.getByRole("searchbox", {
      name: "Search MCP tools and prompts",
    });

    await user.type(search, "github");
    await user.click(
      screen.getByRole("button", { name: /github 0 of 6 selected/i }),
    );
    expect(screen.queryByText("search_repositories")).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "delete_repository");

    expect(screen.getByText("delete_repository")).toBeVisible();
    expect(
      screen.getByRole("button", { name: /github 0 of 6 selected/i }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("expands a provider when selected keys gain that provider after mount", () => {
    const { rerender } = renderPicker();

    expect(screen.queryByText("search_repositories")).not.toBeInTheDocument();

    rerender(
      <SkillCapabilityPicker
        providers={providers}
        selectedKeys={new Set([githubSearchKey])}
        onSelectedKeysChange={vi.fn()}
      />,
    );

    expect(screen.getByText("search_repositories")).toBeVisible();
    expect(
      screen.getByRole("checkbox", { name: /search_repositories/i }),
    ).toBeChecked();
  });

  it("does not reopen a selected provider the user collapsed when selected provider did not change", async () => {
    const user = userEvent.setup();
    const { rerender } = renderPicker({
      selectedKeys: new Set([githubSearchKey]),
    });

    await user.click(
      screen.getByRole("button", { name: /github 1 of 6 selected/i }),
    );
    expect(screen.queryByText("search_repositories")).not.toBeInTheDocument();

    rerender(
      <SkillCapabilityPicker
        providers={providers}
        selectedKeys={
          new Set([
            githubSearchKey,
            buildSkillCapabilitySelectionKey(
              githubCatalogItemId,
              "tool",
              "delete_repository",
            ),
          ])
        }
        onSelectedKeysChange={vi.fn()}
      />,
    );

    expect(screen.queryByText("search_repositories")).not.toBeInTheDocument();
    expect(screen.queryByText("delete_repository")).not.toBeInTheDocument();
  });

  it("selects and deselects rows without mutating the input set", async () => {
    const user = userEvent.setup();
    const selectedKeys = new Set([githubSearchKey]);
    const onSelectedKeysChange = vi.fn();
    const { rerender } = renderPicker({ selectedKeys, onSelectedKeysChange });

    await user.click(screen.getByText("delete_repository"));

    expect(onSelectedKeysChange).toHaveBeenCalledTimes(1);
    const [nextSelectedKeys, changedKey] = onSelectedKeysChange.mock.calls[0];
    expect(nextSelectedKeys).not.toBe(selectedKeys);
    expect([...selectedKeys]).toEqual([githubSearchKey]);
    expect(nextSelectedKeys).toEqual(
      new Set([
        githubSearchKey,
        buildSkillCapabilitySelectionKey(
          githubCatalogItemId,
          "tool",
          "delete_repository",
        ),
      ]),
    );
    expect(changedKey).toBe(
      buildSkillCapabilitySelectionKey(
        githubCatalogItemId,
        "tool",
        "delete_repository",
      ),
    );

    onSelectedKeysChange.mockClear();
    rerender(
      <SkillCapabilityPicker
        providers={providers}
        selectedKeys={selectedKeys}
        onSelectedKeysChange={onSelectedKeysChange}
      />,
    );
    await user.click(screen.getByText("search_repositories"));

    const [nextDeselectedKeys, deselectedKey] =
      onSelectedKeysChange.mock.calls[0];
    expect(nextDeselectedKeys).toEqual(new Set());
    expect(deselectedKey).toBe(githubSearchKey);
  });

  it("selects all tools and prompts for a provider from the provider checkbox", async () => {
    const user = userEvent.setup();
    const onSelectedKeysChange = vi.fn();
    renderPicker({ onSelectedKeysChange });

    await user.click(
      screen.getByRole("checkbox", {
        name: "Select all tools and prompts from github",
      }),
    );

    expect(onSelectedKeysChange).toHaveBeenCalledWith(
      new Set(githubSelectionKeys),
      githubSearchKey,
    );
    expect(onSelectedKeysChange).not.toHaveBeenCalledWith(
      expect.any(Set),
      playwrightScreenshotKey,
    );
  });

  it("deselects all tools and prompts for a provider from the provider checkbox", async () => {
    const user = userEvent.setup();
    const onSelectedKeysChange = vi.fn();
    const selectedKeys = new Set([
      ...githubSelectionKeys,
      playwrightScreenshotKey,
    ]);
    renderPicker({ selectedKeys, onSelectedKeysChange });

    await user.click(
      screen.getByRole("checkbox", {
        name: "Select all tools and prompts from github",
      }),
    );

    expect(onSelectedKeysChange).toHaveBeenCalledWith(
      new Set([playwrightScreenshotKey]),
      githubSearchKey,
    );
  });

  it("shows the provider checkbox as partially checked when some provider items are selected", () => {
    renderPicker({ selectedKeys: new Set([githubSearchKey]) });

    expect(
      screen.getByRole("checkbox", {
        name: "Select all tools and prompts from github",
      }),
    ).toBePartiallyChecked();
  });

  it("keeps the provider checkbox aligned with a selected stale item", () => {
    const staleSelectionKey = buildSkillCapabilitySelectionKey(
      githubCatalogItemId,
      "tool",
      "stale_tool",
    );

    renderPicker({
      providers: [
        {
          name: "github",
          catalogItemId: githubCatalogItemId,
          items: [
            {
              id: "github:stale_tool",
              kind: "tool",
              name: "stale_tool",
              description: "",
              providerName: "github",
              unavailableReason:
                "Saved on this skill but no longer available from this MCP server.",
            },
          ],
        },
      ],
      selectedKeys: new Set([staleSelectionKey]),
    });

    expect(
      screen.getByRole("button", { name: /github 1 of 1 selected/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", {
        name: "Select all tools and prompts from github",
      }),
    ).toBeChecked();
  });

  it("filters by provider name, item name, and item description", () => {
    renderPicker();
    const search = screen.getByRole("searchbox", {
      name: "Search MCP tools and prompts",
    });

    fireEvent.change(search, { target: { value: "github" } });
    expect(screen.getByText("search_repositories")).toBeInTheDocument();
    expect(screen.getByText("write_pull_request")).toBeInTheDocument();
    expect(screen.queryByText("take_screenshot")).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "delete_repository" } });
    expect(screen.getByText("delete_repository")).toBeInTheDocument();
    expect(screen.queryByText("search_repositories")).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "pull request summary" } });
    expect(screen.getByText("write_pull_request")).toBeInTheDocument();
    expect(screen.queryByText("delete_repository")).not.toBeInTheDocument();
  });

  it("filters providers from an MCP server multi-select dropdown", async () => {
    const user = userEvent.setup();
    const onProviderFiltersChange = vi.fn();
    const { rerender } = renderPicker({
      providerFilters: [],
      onProviderFiltersChange,
    });

    await user.click(
      screen.getByRole("button", { name: "Filter MCP servers" }),
    );

    await user.click(
      screen.getByRole("menuitemcheckbox", { name: "playwright" }),
    );

    expect(onProviderFiltersChange).toHaveBeenLastCalledWith(["playwright"]);

    rerender(
      <SkillCapabilityPicker
        providers={providers}
        selectedKeys={new Set()}
        providerFilters={["playwright"]}
        onProviderFiltersChange={onProviderFiltersChange}
        onSelectedKeysChange={vi.fn()}
      />,
    );

    // The menu stays open across selections, so github is toggled directly.
    await user.click(screen.getByRole("menuitemcheckbox", { name: "github" }));

    expect(onProviderFiltersChange).toHaveBeenLastCalledWith([
      "github",
      "playwright",
    ]);

    await user.keyboard("{Escape}");

    rerender(
      <SkillCapabilityPicker
        providers={providers}
        selectedKeys={new Set()}
        providerFilters={["playwright", "github"]}
        onProviderFiltersChange={onProviderFiltersChange}
        onSelectedKeysChange={vi.fn()}
      />,
    );

    expect(
      screen.getByTestId("skill-capability-provider-github"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("skill-capability-provider-playwright"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("No tools or prompts match your search."),
    ).not.toBeInTheDocument();
    expect(screen.getByText("take_screenshot")).toBeVisible();
  });

  it("shows provider logos in the MCP server filter options", async () => {
    const user = userEvent.setup();
    renderPicker({
      providerFilters: [],
      onProviderFiltersChange: vi.fn(),
    });

    await user.click(
      screen.getByRole("button", { name: "Filter MCP servers" }),
    );

    const githubOption = screen.getByRole("menuitemcheckbox", {
      name: "github",
    });
    const playwrightOption = screen.getByRole("menuitemcheckbox", {
      name: "playwright",
    });

    const githubLogo = githubOption.querySelector("img");
    const playwrightLogo = playwrightOption.querySelector("img");

    expect(githubLogo).toHaveAttribute(
      "src",
      "https://icons.example/github.svg",
    );
    expect(githubLogo).toHaveClass("size-5");
    expect(playwrightLogo).toHaveAttribute(
      "src",
      "https://icons.example/playwright.svg",
    );
    expect(playwrightLogo).toHaveClass("size-5");
  });

  it("keeps tools and prompts with the same name independent", async () => {
    const user = userEvent.setup();
    const onSelectedKeysChange = vi.fn();
    renderPicker({ onSelectedKeysChange });

    await user.click(
      screen.getByRole("button", { name: /github 0 of 6 selected/i }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: "Select tool shared_name" }),
    );

    expect(onSelectedKeysChange).toHaveBeenCalledWith(
      new Set([githubSharedToolKey]),
      githubSharedToolKey,
    );
    expect(onSelectedKeysChange).not.toHaveBeenCalledWith(
      new Set([githubSharedPromptKey]),
      githubSharedPromptKey,
    );
  });

  it("disables unavailable provider rows and explains why", async () => {
    const user = userEvent.setup();
    const onSelectedKeysChange = vi.fn();
    renderPicker({
      unavailableProviderNames: new Set(["playwright"]),
      onSelectedKeysChange,
    });

    await user.click(
      screen.getByRole("button", { name: /playwright 0 of 1 selected/i }),
    );

    expect(
      screen.getByText("This server is unavailable for this skill."),
    ).toBeInTheDocument();
    const playwrightSection = screen.getByTestId(
      "skill-capability-provider-playwright",
    );
    expect(
      within(playwrightSection).getByRole("checkbox", {
        name: /take_screenshot/i,
      }),
    ).toBeDisabled();

    await user.click(within(playwrightSection).getByText("take_screenshot"));

    expect(onSelectedKeysChange).not.toHaveBeenCalled();
  });

  it("renders empty states for no providers and no search results", () => {
    const { rerender } = render(
      <SkillCapabilityPicker
        providers={[]}
        selectedKeys={new Set()}
        onSelectedKeysChange={vi.fn()}
      />,
    );

    expect(
      screen.getByText("No MCP tools or prompts available."),
    ).toBeInTheDocument();

    rerender(
      <SkillCapabilityPicker
        providers={providers}
        selectedKeys={new Set()}
        onSelectedKeysChange={vi.fn()}
      />,
    );

    fireEvent.change(
      screen.getByRole("searchbox", {
        name: "Search MCP tools and prompts",
      }),
      { target: { value: "does-not-exist" } },
    );

    expect(
      screen.getByText("No tools or prompts match your search."),
    ).toBeInTheDocument();
  });
});
