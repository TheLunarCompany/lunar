import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CapabilityPromptCard } from "./CapabilityPromptCard";
import type { CapabilityItem } from "./types";

const originalItem: CapabilityItem = {
  id: "filesystem:read_file",
  kind: "tool",
  name: "read_file",
  description: "Read a file",
  providerName: "filesystem",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string" },
      encoding: { type: "string" },
    },
  },
  annotations: { readOnlyHint: true },
};

const customItem: CapabilityItem = {
  ...originalItem,
  id: "filesystem:custom_read_file",
  name: "custom_read_file",
  isCustom: true,
};

describe("CapabilityPromptCard", () => {
  afterEach(() => cleanup());

  it("renders item details through the composable card", () => {
    const { container } = render(<CapabilityPromptCard item={originalItem} />);

    expect(container.querySelector('[data-slot="card"]')).toBeInTheDocument();
    expect(screen.getByText("read_file")).toBeInTheDocument();
    expect(container.querySelector("g#Prompt")).toBeInTheDocument();
    expect(screen.getByText("read_file").parentElement?.className).toContain(
      "--colors-success-100",
    );
    expect(screen.getByText("Read a file")).toBeInTheDocument();
    expect(screen.getByLabelText("Input fields: 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Messages: 0")).toBeInTheDocument();
    expect(screen.getByLabelText("Resources: 0")).toBeInTheDocument();
    expect(
      container.querySelector('[data-slot="card"] > [data-slot="separator"]'),
    ).toBeInTheDocument();
  });

  it("keeps the title badge in the header and selection indicator on the top right", () => {
    const { container } = render(
      <CapabilityPromptCard item={originalItem} isSelectionMode isSelected />,
    );

    expect(screen.getByText("read_file").closest(".flex")).toBeInTheDocument();
    expect(container.querySelector(".absolute.right-2.top-2")).toBeTruthy();
  });

  it("places the custom indicator after the description and aligns it left", () => {
    render(<CapabilityPromptCard item={customItem} />);

    const description = screen.getByText("Read a file");
    const customIndicator = screen.getByText("CUSTOM");
    const leftAlignedRow = customIndicator.closest(".justify-start");

    expect(
      Boolean(
        description.compareDocumentPosition(customIndicator) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
    expect(leftAlignedRow).toBeInTheDocument();
  });

  it("supports selection mode on the item card", () => {
    const onToggleSelection = vi.fn();

    render(
      <CapabilityPromptCard
        item={originalItem}
        isSelectionMode
        isSelected
        onToggleSelection={onToggleSelection}
      />,
    );

    const card = screen.getByRole("checkbox", { name: "read_file" });

    expect(card).toHaveAttribute("aria-checked", "true");
    fireEvent.keyDown(card, { key: "Enter" });
    fireEvent.click(card);

    expect(onToggleSelection).toHaveBeenCalledTimes(2);
    expect(
      screen.queryByRole("button", { name: "Open capability item menu" }),
    ).not.toBeInTheDocument();
  });

  it("does not select custom items while adding a custom tool", () => {
    const onToggleSelection = vi.fn();
    const onShowDetails = vi.fn();

    render(
      <CapabilityPromptCard
        item={customItem}
        isSelectionMode
        isAddCustomToolMode
        onToggleSelection={onToggleSelection}
        onShowDetails={onShowDetails}
      />,
    );

    const card = screen.getByRole("checkbox", { name: "custom_read_file" });

    fireEvent.click(card);
    fireEvent.keyDown(card, { key: "Enter" });

    expect(onToggleSelection).not.toHaveBeenCalled();
    expect(onShowDetails).toHaveBeenCalledTimes(1);
  });

  it("renders catalog-style actions without customize for original prompt items", () => {
    const onShowDetails = vi.fn();
    const onCustomizeItem = vi.fn();

    render(
      <CapabilityPromptCard
        item={originalItem}
        onShowDetails={onShowDetails}
        onCustomizeItem={onCustomizeItem}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Open read_file menu" }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Details" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Open read_file menu" }),
    );

    expect(onShowDetails).toHaveBeenCalledWith(originalItem);
    expect(screen.queryByRole("menuitem", { name: "Customize" })).toBeNull();
    expect(onCustomizeItem).not.toHaveBeenCalled();
    expect(screen.queryByRole("menuitem", { name: "Delete" })).toBeNull();
  });

  it("renders edit and delete actions for custom prompt items", () => {
    const onShowDetails = vi.fn();
    const onCustomizeItem = vi.fn();
    const onEditItem = vi.fn();
    const onDeleteItem = vi.fn();

    render(
      <CapabilityPromptCard
        item={customItem}
        onShowDetails={onShowDetails}
        onCustomizeItem={onCustomizeItem}
        onEditItem={onEditItem}
        onDeleteItem={onDeleteItem}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Open custom_read_file menu" }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Open custom_read_file menu" }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

    expect(onEditItem).toHaveBeenCalledWith(customItem);
    expect(onDeleteItem).toHaveBeenCalledWith(customItem);
  });
});
