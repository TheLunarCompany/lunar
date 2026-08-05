import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MultiSelectFilterDropdown } from "./multi-select-filter-dropdown";

const options = ["Claude", "Cursor"];

function renderFilter() {
  return render(
    <MultiSelectFilterDropdown
      options={options}
      getOptionValue={(option) => option}
      renderOption={(option) => option}
      selectedValues={[]}
      onSelectedValuesChange={vi.fn()}
      allLabel="All agents"
      triggerContent="Agents"
      triggerLabel="Filter by agents"
      searchPlaceholder="Search agents..."
    />,
  );
}

describe("MultiSelectFilterDropdown", () => {
  it("filters options from its searchable popover", async () => {
    const user = userEvent.setup();
    renderFilter();

    await user.click(screen.getByRole("button", { name: "Filter by agents" }));
    const searchInput = screen.getByRole("textbox", {
      name: "Search agents...",
    });
    expect(searchInput).toHaveClass("rounded-md");
    await user.type(searchInput, "cursor");

    expect(
      screen.queryByRole("menuitemcheckbox", { name: "Claude" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("menuitemcheckbox", { name: "Cursor" }),
    ).toBeInTheDocument();
  });

  it("shows an empty state when no options match the search", async () => {
    const user = userEvent.setup();
    renderFilter();

    await user.click(screen.getByRole("button", { name: "Filter by agents" }));
    await user.type(
      screen.getByRole("textbox", { name: "Search agents..." }),
      "unknown",
    );

    expect(screen.getByText("No results found.")).toBeInTheDocument();
  });
});
