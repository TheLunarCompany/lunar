import {
  cleanup,
  fireEvent,
  render as renderWithTestingLibrary,
  screen,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CapabilityGroupSheet } from "./CapabilityGroupSheet";
import type { CapabilityGroup, CapabilityProvider } from "./types";

function render(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return renderWithTestingLibrary(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

const group: CapabilityGroup = {
  id: "tool_group_0",
  name: "Readers",
  description: "Read-only access",
  services: { filesystem: ["read_file", "summarize_prompt"] },
  providers: [
    {
      providerName: "filesystem",
      itemCount: 2,
      toolCount: 1,
      promptCount: 1,
      itemNames: ["read_file", "summarize_prompt"],
      selectionKeys: ["filesystem:read_file", "filesystem:summarize_prompt"],
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
      {
        id: "filesystem:summarize_prompt",
        kind: "prompt",
        name: "summarize_prompt",
        description: "Summarize recent file changes",
        providerName: "filesystem",
      },
    ],
  },
];

describe("CapabilityGroupSheet", () => {
  afterEach(() => cleanup());

  it("renders the redesigned group header, provider badges, tabs, and item cards", () => {
    const onShowItemDetails = vi.fn();

    render(
      <CapabilityGroupSheet
        isOpen
        group={group}
        providers={providers}
        onOpenChange={vi.fn()}
        onShowItemDetails={onShowItemDetails}
        onEditGroup={vi.fn()}
        onUpdateGroupItems={vi.fn()}
        onDeleteGroup={vi.fn()}
      />,
    );

    expect(screen.getByText("Readers")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "filesystem" }),
    ).toBeInTheDocument();
    expect(screen.getByText("read_file")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Tools 1" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Prompts 1" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Resources 0" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Edit Tool Group" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Update Tools" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();

    fireEvent.click(screen.getByText("read_file"));

    expect(onShowItemDetails).toHaveBeenCalledWith(
      expect.objectContaining({ name: "read_file" }),
    );
  });

  it("filters the active tab by item name, description, and provider name", () => {
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

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search tools and prompts" }),
      {
        target: { value: "missing" },
      },
    );

    expect(screen.getByText("No tools match your search.")).toBeInTheDocument();

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search tools and prompts" }),
      {
        target: { value: "filesystem" },
      },
    );

    expect(screen.getByText("read_file")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Prompts 1" }));

    expect(screen.getByText("summarize_prompt")).toBeInTheDocument();
  });

  it("surfaces prompt matches from the search input", () => {
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

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search tools and prompts" }),
      {
        target: { value: "Summarize recent" },
      },
    );

    expect(screen.getByRole("tab", { name: "Prompts 1" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("summarize_prompt")).toBeInTheDocument();
  });

  it("does not clip the search input focus ring", () => {
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

    const searchInput = screen.getByRole("searchbox", {
      name: "Search tools and prompts",
    });
    const sheetBody = searchInput.closest("[data-capability-group-sheet-body]");

    expect(sheetBody).toBeInTheDocument();
    expect(sheetBody).not.toHaveClass("overflow-hidden");
  });

  it("starts the group description after the icon column", () => {
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

    const description = screen.getByText("Read-only access");

    expect(description).toHaveAttribute(
      "data-capability-group-sheet-description",
    );
    expect(description).toHaveClass("col-start-2");
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
              toolCount: 1,
              promptCount: 0,
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
