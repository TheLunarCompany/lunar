import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CapabilityCatalogItemCard } from "./CapabilityCatalogItemCard";
import type { CapabilityItem } from "./types";

const item: CapabilityItem = {
  id: "filesystem:read_file",
  kind: "tool",
  name: "read_file",
  description: "Read a file",
  providerName: "filesystem",
  inputSchema: { type: "object" },
  annotations: { readOnlyHint: true },
};

describe("CapabilityCatalogItemCard", () => {
  afterEach(() => cleanup());

  it("exposes a single checkbox role for a selected item card", () => {
    render(
      <CapabilityCatalogItemCard
        item={item}
        isSelectionMode
        isSelected
        onToggleSelection={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(screen.getByRole("checkbox")).toHaveAccessibleName("read_file");
  });

  it("keeps selection keyboard activation on the item card", () => {
    const onToggleSelection = vi.fn();

    render(
      <CapabilityCatalogItemCard
        item={item}
        isSelectionMode
        onToggleSelection={onToggleSelection}
      />,
    );

    fireEvent.keyDown(screen.getByRole("checkbox", { name: "read_file" }), {
      key: "Enter",
    });

    expect(onToggleSelection).toHaveBeenCalledTimes(1);
  });
});
