import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CatalogMCPServerConfigByNameItem } from "@mcpx/toolkit-ui/src/utils/server-helpers";
import { McpServerCatalogCard } from "./McpServerCatalogCard";

vi.mock("@/hooks/useDomainIcon", () => ({
  useDomainIcon: () => "",
}));

const catalogServer: CatalogMCPServerConfigByNameItem = {
  id: "0190a000-0000-7000-8000-000000000001",
  name: "github",
  displayName: "GitHub",
  description: "GitHub MCP server",
  link: "https://github.com/example/github-mcp",
  doc: "https://docs.example.com/github-mcp",
  config: {
    github: {
      type: "stdio",
      command: "npx",
      args: ["-y", "@example/github-mcp"],
      env: {
        GITHUB_TOKEN: { kind: "required", isSecret: true },
      },
    },
  },
};

describe("McpServerCatalogCard", () => {
  it("renders installed servers without an interactive card button", () => {
    render(<McpServerCatalogCard server={catalogServer} checkboxDisabled />);

    expect(screen.getByText("Installed")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("marks selected cards with selected presentation", () => {
    const { container } = render(
      <McpServerCatalogCard
        server={catalogServer}
        checked
        onCheckedChange={vi.fn()}
      />,
    );

    const card = container.firstElementChild;
    expect(card).toHaveAttribute("aria-pressed", "true");
    expect(card?.className).toContain("border-[#5147E4]");
    expect(card?.className).toContain("bg-[#F7F6FE]");
  });

  it("toggles selection from mouse and keyboard interactions", () => {
    const onCheckedChange = vi.fn();
    const { container } = render(
      <McpServerCatalogCard
        server={catalogServer}
        checked={false}
        onCheckedChange={onCheckedChange}
      />,
    );

    const card = container.querySelector('[role="button"]');
    expect(card).toHaveAttribute("tabindex", "0");

    fireEvent.click(card as Element);
    fireEvent.keyDown(card as Element, { key: "Enter" });
    fireEvent.keyDown(card as Element, { key: " " });

    expect(onCheckedChange).toHaveBeenCalledTimes(3);
    expect(onCheckedChange).toHaveBeenNthCalledWith(1, true);
    expect(onCheckedChange).toHaveBeenNthCalledWith(2, true);
    expect(onCheckedChange).toHaveBeenNthCalledWith(3, true);
  });

  it("replaces the checkbox with a spinner only while the server is adding", () => {
    const onCheckedChange = vi.fn();
    const { container, rerender } = render(
      <McpServerCatalogCard
        server={catalogServer}
        checked
        onCheckedChange={onCheckedChange}
        isAdding
      />,
    );

    expect(
      screen.getByRole("status", { name: "Adding GitHub" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();

    fireEvent.click(container.firstElementChild as Element);
    expect(onCheckedChange).not.toHaveBeenCalled();

    rerender(
      <McpServerCatalogCard
        server={catalogServer}
        checked
        onCheckedChange={onCheckedChange}
      />,
    );

    expect(
      screen.queryByRole("status", { name: "Adding GitHub" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("renders environment variables in the footer instead of docs links", () => {
    render(<McpServerCatalogCard server={catalogServer} />);

    const description = screen.getByText("GitHub MCP server");
    const envVarsLabel = screen.getByText("ENV. VARS");

    expect(screen.getByText("GITHUB_TOKEN")).toBeInTheDocument();
    expect(
      description.compareDocumentPosition(envVarsLabel) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
