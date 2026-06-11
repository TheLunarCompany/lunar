import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CapabilityGroupsSection } from "./CapabilityGroupsSection";
import type { CapabilityGroup } from "./types";

function makeGroup(index: number): CapabilityGroup {
  return {
    id: `tool_group_${index}`,
    name: `Group ${index}`,
    description: `Group ${index} description`,
    services: { filesystem: [`tool_${index}`] },
    providers: [
      {
        providerName: "filesystem",
        itemCount: 1,
        itemNames: [`tool_${index}`],
        selectionKeys: [`filesystem:tool_${index}`],
      },
    ],
  };
}

describe("CapabilityGroupsSection", () => {
  afterEach(() => cleanup());

  it("paginates groups after the first 8 and lets users navigate back", () => {
    const groups = Array.from({ length: 10 }, (_, index) =>
      makeGroup(index + 1),
    );

    render(
      <CapabilityGroupsSection
        groups={groups}
        selectedGroupName={null}
        onCreateGroupClick={vi.fn()}
        onGroupClick={vi.fn()}
        onEditGroup={vi.fn()}
        onUpdateGroupItems={vi.fn()}
        onDeleteGroup={vi.fn()}
      />,
    );

    expect(screen.getByText("Group 1")).toBeInTheDocument();
    expect(screen.queryByText("Group 9")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next tool groups" }));

    expect(screen.getByText("Group 9")).toBeInTheDocument();
    expect(screen.queryByText("Group 1")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Show tool groups page 1" }),
    );

    expect(screen.getByText("Group 1")).toBeInTheDocument();
    expect(screen.queryByText("Group 9")).not.toBeInTheDocument();
  });

  it("activates a group card from the keyboard and exposes menu actions from a button trigger", () => {
    const onGroupClick = vi.fn();
    const onEditGroup = vi.fn();
    const onUpdateGroupItems = vi.fn();
    const onDeleteGroup = vi.fn();
    const group = makeGroup(1);

    render(
      <CapabilityGroupsSection
        groups={[group]}
        selectedGroupName={null}
        onCreateGroupClick={vi.fn()}
        onGroupClick={onGroupClick}
        onEditGroup={onEditGroup}
        onUpdateGroupItems={onUpdateGroupItems}
        onDeleteGroup={onDeleteGroup}
      />,
    );

    fireEvent.keyDown(screen.getByRole("button", { name: "Open Group 1" }), {
      key: "Enter",
    });
    expect(onGroupClick).toHaveBeenCalledWith(group);

    fireEvent.click(screen.getByRole("button", { name: "Open Group 1 menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Update Tools" }));
    expect(onUpdateGroupItems).toHaveBeenCalledWith(group);
  });

  it("renders capability group card metrics and provider counts", () => {
    const group: CapabilityGroup = {
      ...makeGroup(1),
      providers: [
        {
          providerName: "filesystem",
          itemCount: 3,
          itemNames: ["read", "write", "delete"],
          selectionKeys: [
            "filesystem:read",
            "filesystem:write",
            "filesystem:delete",
          ],
        },
      ],
    };

    render(
      <CapabilityGroupsSection
        groups={[group]}
        selectedGroupName={null}
        onCreateGroupClick={vi.fn()}
        onGroupClick={vi.fn()}
        onEditGroup={vi.fn()}
        onUpdateGroupItems={vi.fn()}
        onDeleteGroup={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Tools: 3")).toBeInTheDocument();
    expect(screen.getByLabelText("Prompts: 0")).toBeInTheDocument();
    expect(screen.getByLabelText("Resources: 0")).toBeInTheDocument();
    expect(screen.getByText("filesystem")).toBeInTheDocument();
  });

  it("keeps the group menu trigger outside the keyboard-activated card button", () => {
    const group = makeGroup(1);

    render(
      <CapabilityGroupsSection
        groups={[group]}
        selectedGroupName={null}
        onCreateGroupClick={vi.fn()}
        onGroupClick={vi.fn()}
        onEditGroup={vi.fn()}
        onUpdateGroupItems={vi.fn()}
        onDeleteGroup={vi.fn()}
      />,
    );

    const cardButton = screen.getByRole("button", { name: "Open Group 1" });
    const menuButton = screen.getByRole("button", {
      name: "Open Group 1 menu",
    });

    expect(cardButton).not.toContainElement(menuButton);
  });

  it("labels wildcard groups as all tools instead of zero in group", () => {
    render(
      <CapabilityGroupsSection
        groups={[
          {
            ...makeGroup(1),
            providers: [
              {
                providerName: "filesystem",
                itemCount: 0,
                itemNames: [],
                selectionKeys: [],
                isWildcard: true,
              },
            ],
            services: { filesystem: "*" },
          },
        ]}
        selectedGroupName={null}
        onCreateGroupClick={vi.fn()}
        onGroupClick={vi.fn()}
        onEditGroup={vi.fn()}
        onUpdateGroupItems={vi.fn()}
        onDeleteGroup={vi.fn()}
      />,
    );

    expect(screen.getByText("All tools")).toBeInTheDocument();
    expect(screen.queryByText("0 in group")).not.toBeInTheDocument();
  });
});
