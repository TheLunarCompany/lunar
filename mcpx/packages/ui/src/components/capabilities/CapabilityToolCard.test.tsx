import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CapabilityToolCard } from "./CapabilityToolCard";
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

describe("CapabilityToolCard", () => {
  afterEach(() => cleanup());

  it("renders item details through the composable card with the tool title treatment", () => {
    const { container } = render(<CapabilityToolCard item={originalItem} />);

    expect(container.querySelector('[data-slot="card"]')).toBeInTheDocument();
    expect(screen.getByText("read_file")).toBeInTheDocument();
    expect(screen.getByLabelText("Capability type icon")).toBeInTheDocument();
    expect(screen.getByText("read_file").parentElement?.className).toContain(
      "--colors-primary-100",
    );
    expect(screen.getByText("READ ONLY")).toBeInTheDocument();
    expect(screen.getByText("Read a file")).toBeInTheDocument();
    expect(screen.getByLabelText("Input fields: 2")).toBeInTheDocument();
    // Tools only expose input fields; messages/resources are prompt metrics.
    expect(screen.queryByLabelText(/^Messages:/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Resources:/)).not.toBeInTheDocument();
    // No token count on this item, so the tokens metric is hidden.
    expect(
      screen.queryByLabelText(/^Estimated tokens:/),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-slot="card"] > [data-slot="separator"]'),
    ).toBeInTheDocument();
  });

  it("shows the estimated tokens metric only when a token count is present", () => {
    const { rerender } = render(<CapabilityToolCard item={originalItem} />);
    expect(
      screen.queryByLabelText(/^Estimated tokens:/),
    ).not.toBeInTheDocument();

    rerender(
      <CapabilityToolCard item={{ ...originalItem, estimatedTokens: 142 }} />,
    );
    expect(screen.getByLabelText("Estimated tokens: 142")).toBeInTheDocument();
  });

  it("keeps the status badge in the header and selection indicator on the top right", () => {
    const { container } = render(
      <CapabilityToolCard item={originalItem} isSelectionMode isSelected />,
    );

    expect(screen.getByText("READ ONLY").closest(".flex")).toContainElement(
      screen.getByText("read_file"),
    );
    expect(container.querySelector(".absolute.right-2.top-2")).toBeTruthy();
  });

  it("places the custom indicator after the description and aligns it left", () => {
    render(<CapabilityToolCard item={customItem} />);

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
      <CapabilityToolCard
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

  it("renders catalog-style actions for original and custom items", () => {
    const onShowDetails = vi.fn();
    const onCustomizeItem = vi.fn();
    const onEditItem = vi.fn();
    const onDeleteItem = vi.fn();

    const { rerender } = render(
      <CapabilityToolCard
        item={originalItem}
        onShowDetails={onShowDetails}
        onCustomizeItem={onCustomizeItem}
        onEditItem={onEditItem}
        onDeleteItem={onDeleteItem}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Open read_file menu" }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Details" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Open read_file menu" }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Customize" }));

    expect(onShowDetails).toHaveBeenCalledWith(originalItem);
    expect(onCustomizeItem).toHaveBeenCalledWith(originalItem);
    expect(screen.queryByRole("menuitem", { name: "Delete" })).toBeNull();

    rerender(
      <CapabilityToolCard
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
