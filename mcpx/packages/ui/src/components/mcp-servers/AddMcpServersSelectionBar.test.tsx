import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AddMcpServersSelectionBar } from "./AddMcpServersSelectionBar";

describe("AddMcpServersSelectionBar", () => {
  it("shows the empty label and disables Add when no servers are selected", () => {
    render(
      <AddMcpServersSelectionBar
        selectedCount={0}
        hasAvailableServers
        onAdd={vi.fn()}
      />,
    );

    expect(screen.getByText("No Servers selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  });

  it("uses the singular label for one selected server", () => {
    render(
      <AddMcpServersSelectionBar
        selectedCount={1}
        hasAvailableServers
        onAdd={vi.fn()}
      />,
    );

    expect(screen.getByText("1 Server selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeEnabled();
  });

  it("uses the plural label for multiple selected servers", () => {
    render(
      <AddMcpServersSelectionBar
        selectedCount={3}
        hasAvailableServers
        onAdd={vi.fn()}
      />,
    );

    expect(screen.getByText("3 Servers selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeEnabled();
  });

  it("disables Add while selected servers are being added", () => {
    render(
      <AddMcpServersSelectionBar
        selectedCount={2}
        hasAvailableServers
        onAdd={vi.fn()}
        isAdding
      />,
    );

    expect(screen.getByRole("button", { name: "Adding..." })).toBeDisabled();
  });

  it("does not render when every catalog server is already installed", () => {
    render(
      <AddMcpServersSelectionBar
        selectedCount={0}
        hasAvailableServers={false}
        onAdd={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("region", { name: "Server selection summary" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("No Servers selected")).not.toBeInTheDocument();
  });
});
