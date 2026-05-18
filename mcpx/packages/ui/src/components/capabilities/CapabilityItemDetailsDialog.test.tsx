import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CapabilityItemDetailsDialog } from "./CapabilityItemDetailsDialog";

describe("CapabilityItemDetailsDialog", () => {
  afterEach(() => cleanup());

  it("renders tool schema fields and custom tool edit/delete actions", () => {
    render(
      <CapabilityItemDetailsDialog
        isOpen
        item={{
          id: "filesystem:safe_read",
          kind: "tool",
          name: "custom_safe_read",
          description: "Read a **file** safely",
          providerName: "asana",
          isCustom: true,
          originalToolName: "read_file",
          inputSchema: {
            type: "object",
            properties: {
              path: { type: "string", description: "File path" },
            },
          },
        }}
        onClose={vi.fn()}
        onCustomizeItem={vi.fn()}
        onEditItem={vi.fn()}
        onDeleteItem={vi.fn()}
      />,
    );

    expect(screen.getByText("Asana")).toHaveClass("text-lg");
    expect(screen.getByText("read_file")).toBeInTheDocument();
    expect(screen.getByText("custom_safe_read")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "asana favicon" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Custom capability icon")).toBeInTheDocument();
    expect(screen.getByText("file")).toHaveClass("font-semibold");
    expect(screen.getByText("path")).toBeInTheDocument();
    expect(screen.getByText("string")).toBeInTheDocument();
    expect(screen.getByText("File path")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Customize capability" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit custom capability" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete custom capability" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Close" })).toHaveLength(1);
  });

  it("does not expose Edit or Delete for base tools", () => {
    render(
      <CapabilityItemDetailsDialog
        isOpen
        item={{
          id: "filesystem:read_file",
          kind: "tool",
          name: "read_file",
          description: "Read a file",
          providerName: "filesystem",
          inputSchema: {
            type: "object",
            properties: {
              path: { type: "string", description: "File path" },
            },
          },
        }}
        onClose={vi.fn()}
        onCustomizeItem={vi.fn()}
        onEditItem={vi.fn()}
        onDeleteItem={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Customize capability" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit custom capability" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete custom capability" }),
    ).not.toBeInTheDocument();
  });

  it("renders prompt template messages in the details drawer", () => {
    render(
      <CapabilityItemDetailsDialog
        isOpen
        item={{
          id: "linear:issue_triage_summary",
          kind: "prompt",
          name: "issue_triage_summary",
          description: "Summarize open Linear issues",
          providerName: "linear",
          inputSchema: {
            type: "object",
            properties: {
              teamKey: { type: "string", description: "Linear team key" },
            },
          },
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: "Summarize the current Linear triage queue.",
              },
            },
            {
              role: "assistant",
              content: {
                type: "text",
                text: "I will group issues by priority and blocker status.",
              },
            },
          ],
        }}
        onClose={vi.fn()}
        onCustomizeItem={vi.fn()}
        onEditItem={vi.fn()}
        onDeleteItem={vi.fn()}
      />,
    );

    expect(screen.getByText("Messages")).toBeInTheDocument();
    expect(screen.getByLabelText("User message")).toBeInTheDocument();
    expect(screen.getByLabelText("Assistant message")).toBeInTheDocument();
    expect(screen.getByText("User")).toBeInTheDocument();
    expect(screen.getByText("Assistant")).toBeInTheDocument();
    expect(
      screen.getByText("Summarize the current Linear triage queue."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("I will group issues by priority and blocker status."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Customize capability" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit custom capability" }),
    ).not.toBeInTheDocument();
  });
});
