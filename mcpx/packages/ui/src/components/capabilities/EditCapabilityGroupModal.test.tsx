import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditCapabilityGroupModal } from "./EditCapabilityGroupModal";

describe("EditCapabilityGroupModal", () => {
  afterEach(() => cleanup());

  it("renders the existing group name and description", () => {
    render(
      <EditCapabilityGroupModal
        isOpen
        group={{
          id: "tool_group_0",
          name: "Readers",
          description: "Read-only access",
          services: { filesystem: ["read_file"] },
          providers: [],
        }}
        onClose={vi.fn()}
        onSubmitCapabilityGroup={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue("Readers")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Read-only access")).toBeInTheDocument();
  });

  it("keeps breathing room between labels and fields", () => {
    render(
      <EditCapabilityGroupModal
        isOpen
        group={{
          id: "tool_group_0",
          name: "Readers",
          description: "Read-only access",
          services: { filesystem: ["read_file"] },
          providers: [],
        }}
        onClose={vi.fn()}
        onSubmitCapabilityGroup={vi.fn()}
      />,
    );

    expect(screen.getByText("Group Name").parentElement).toHaveClass(
      "space-y-3",
    );
    expect(screen.getByText("Description").parentElement).toHaveClass(
      "space-y-3",
    );
  });
});
