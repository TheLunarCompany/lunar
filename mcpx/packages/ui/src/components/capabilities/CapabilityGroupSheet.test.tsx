import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CapabilityGroupSheet } from "./CapabilityGroupSheet";
import type { CapabilityGroup, CapabilityProvider } from "./types";

const group: CapabilityGroup = {
  id: "tool_group_0",
  name: "Readers",
  description: "Read-only access",
  services: { filesystem: ["read_file"] },
  providers: [
    {
      providerName: "filesystem",
      itemCount: 1,
      itemNames: ["read_file"],
      selectionKeys: ["filesystem:read_file"],
    },
  ],
};

const providers: CapabilityProvider[] = [
  {
    name: "filesystem",
    state: { type: "connected" },
    icon: "folder",
    items: [
      {
        id: "filesystem:read_file",
        kind: "tool",
        name: "read_file",
        description: "Read a file",
        providerName: "filesystem",
      },
    ],
  },
];

describe("CapabilityGroupSheet", () => {
  afterEach(() => cleanup());

  it("lists providers and items and exposes Details, Edit, Update, and Delete actions", () => {
    render(
      <CapabilityGroupSheet
        isOpen
        group={group}
        providers={providers}
        onOpenChange={vi.fn()}
        onShowItemDetails={vi.fn()}
        onEditGroup={vi.fn()}
        onUpdateGroupItems={vi.fn()}
        onDeleteGroup={vi.fn()}
      />,
    );

    expect(screen.getByText("Readers")).toBeInTheDocument();
    expect(screen.getByText("filesystem")).toBeInTheDocument();
    expect(screen.getByText("read_file")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit Tool Group" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Update Tools" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Details for read_file" }),
    ).toBeInTheDocument();
  });

  it("renders a provider logo in the provider header when a known logo exists", () => {
    render(
      <CapabilityGroupSheet
        isOpen
        group={{
          ...group,
          services: { github: ["list_repos"] },
          providers: [
            {
              providerName: "github",
              itemCount: 1,
              itemNames: ["list_repos"],
              selectionKeys: ["github:list_repos"],
            },
          ],
        }}
        providers={[
          {
            name: "github",
            state: { type: "connected" },
            icon: "github",
            items: [
              {
                id: "github:list_repos",
                kind: "tool",
                name: "list_repos",
                description: "List repositories",
                providerName: "github",
              },
            ],
          },
        ]}
        onOpenChange={vi.fn()}
        onShowItemDetails={vi.fn()}
        onEditGroup={vi.fn()}
        onUpdateGroupItems={vi.fn()}
        onDeleteGroup={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("img", { name: "github favicon" }),
    ).toBeInTheDocument();
  });

  it("renders an empty state when no group is selected", () => {
    render(
      <CapabilityGroupSheet
        isOpen
        group={null}
        providers={[]}
        onOpenChange={vi.fn()}
        onShowItemDetails={vi.fn()}
        onEditGroup={vi.fn()}
        onUpdateGroupItems={vi.fn()}
        onDeleteGroup={vi.fn()}
      />,
    );

    expect(screen.getByText("No tool group selected")).toBeInTheDocument();
  });
});
