import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CreateCapabilityGroupModal } from "./CreateCapabilityGroupModal";

describe("CreateCapabilityGroupModal", () => {
  afterEach(() => cleanup());

  it("validates a non-empty name and selected tool count before submit", () => {
    const onSubmitCapabilityGroup = vi.fn();

    render(
      <CreateCapabilityGroupModal
        isOpen
        onClose={vi.fn()}
        selectedItemCount={0}
        onSubmitCapabilityGroup={onSubmitCapabilityGroup}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Create Group" }));
    expect(screen.getByText("Group name cannot be empty")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Group Name"), {
      target: { value: "Readers" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Group" }));

    expect(
      screen.getByText("Select at least one tool before creating a group."),
    ).toBeInTheDocument();
    expect(onSubmitCapabilityGroup).not.toHaveBeenCalled();
  });

  it("shows duplicate-name validation returned by the capability hook", () => {
    render(
      <CreateCapabilityGroupModal
        isOpen
        onClose={vi.fn()}
        selectedItemCount={1}
        error='A capability group named "Readers" already exists.'
        onSubmitCapabilityGroup={vi.fn()}
      />,
    );

    expect(
      screen.getByText('A capability group named "Readers" already exists.'),
    ).toBeInTheDocument();
  });

  it("keeps breathing room between labels and fields", () => {
    render(
      <CreateCapabilityGroupModal
        isOpen
        onClose={vi.fn()}
        selectedItemCount={1}
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
