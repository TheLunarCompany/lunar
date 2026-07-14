import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CustomCapabilityToolDialog } from "./CustomCapabilityToolDialog";

vi.mock("@/hooks/useDomainIcon", () => ({
  useDomainIcon: (name: string) => `/icons/${name}.png`,
}));

describe("CustomCapabilityToolDialog", () => {
  afterEach(() => cleanup());

  it("submits through capability-domain callback props", () => {
    const onSubmitCustomCapabilityTool = vi.fn();

    render(
      <CustomCapabilityToolDialog
        isOpen
        onOpenChange={vi.fn()}
        onClose={vi.fn()}
        providers={[
          {
            name: "filesystem",
            items: [
              {
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
              },
            ],
          },
        ]}
        preSelectedProviderName="filesystem"
        preSelectedItemName="read_file"
        onSubmitCustomCapabilityTool={onSubmitCustomCapabilityTool}
      />,
    );

    fireEvent.change(screen.getByLabelText("Custom tool name"), {
      target: { value: "safe_read" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Read safely" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmitCustomCapabilityTool).toHaveBeenCalledWith({
      providerName: "filesystem",
      baseCapabilityName: "read_file",
      customCapabilityName: "safe_read",
      description: "Read safely",
      parameters: [{ name: "path", description: "File path", value: "" }],
    });
  });

  it("prefills the custom tool name when customizing an original tool", () => {
    render(
      <CustomCapabilityToolDialog
        isOpen
        onOpenChange={vi.fn()}
        onClose={vi.fn()}
        providers={[
          {
            name: "filesystem",
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
        ]}
        preSelectedProviderName="filesystem"
        preSelectedItemName="read_file"
        onSubmitCustomCapabilityTool={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Custom tool name")).toHaveValue(
      "Custom_read_file",
    );
  });

  it("submits canonical provider and item names from the provider list", () => {
    const onSubmitCustomCapabilityTool = vi.fn();

    render(
      <CustomCapabilityToolDialog
        isOpen
        onOpenChange={vi.fn()}
        onClose={vi.fn()}
        providers={[
          {
            name: "filesystem",
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
          {
            name: "github",
            items: [
              {
                id: "github:search_repositories",
                kind: "tool",
                name: "search_repositories",
                description: "Search repositories",
                providerName: "github",
              },
            ],
          },
        ]}
        onSubmitCustomCapabilityTool={onSubmitCustomCapabilityTool}
      />,
    );

    fireEvent.change(screen.getByLabelText("Server"), {
      target: { value: "github" },
    });
    fireEvent.change(screen.getByLabelText("Tool"), {
      target: { value: "search_repositories" },
    });
    fireEvent.change(screen.getByLabelText("Custom tool name"), {
      target: { value: "safe_search" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmitCustomCapabilityTool).toHaveBeenCalledWith(
      expect.objectContaining({
        providerName: "github",
        baseCapabilityName: "search_repositories",
      }),
    );
  });

  it("locks the custom tool name in edit mode and submits the original name", () => {
    const onSubmitCustomCapabilityTool = vi.fn();

    render(
      <CustomCapabilityToolDialog
        isOpen
        onOpenChange={vi.fn()}
        onClose={vi.fn()}
        providers={[
          {
            name: "filesystem",
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
        ]}
        preSelectedProviderName="filesystem"
        preSelectedItemName="read_file"
        preFilledData={{
          name: "safe_read",
          description: "Read safely",
          parameters: [],
        }}
        onSubmitCustomCapabilityTool={onSubmitCustomCapabilityTool}
      />,
    );

    const nameInput = screen.getByLabelText("Custom tool name");
    expect(nameInput).toBeDisabled();

    fireEvent.change(nameInput, { target: { value: "renamed_read" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmitCustomCapabilityTool).toHaveBeenCalledWith(
      expect.objectContaining({
        customCapabilityName: "safe_read",
        originalCustomCapabilityName: "safe_read",
      }),
    );
  });
});
