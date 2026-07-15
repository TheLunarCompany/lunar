import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AddMcpServersSelectionBar } from "./AddMcpServersSelectionBar";

describe("AddMcpServersSelectionBar", () => {
  it("shows the empty label and disables Add when no servers are selected", () => {
    render(<AddMcpServersSelectionBar selectedCount={0} onAdd={vi.fn()} />);

    expect(screen.getByText("No Servers selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  });

  it("uses the singular label for one selected server", () => {
    render(<AddMcpServersSelectionBar selectedCount={1} onAdd={vi.fn()} />);

    expect(screen.getByText("1 Server selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeEnabled();
  });

  it("uses the plural label for multiple selected servers", () => {
    render(<AddMcpServersSelectionBar selectedCount={3} onAdd={vi.fn()} />);

    expect(screen.getByText("3 Servers selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeEnabled();
  });

  it("disables Add while selected servers are being added", () => {
    render(
      <AddMcpServersSelectionBar selectedCount={2} onAdd={vi.fn()} isAdding />,
    );

    expect(screen.getByRole("button", { name: "Adding..." })).toBeDisabled();
  });
});
