import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CatalogMCPServerConfigByNameItem } from "@mcpx/toolkit-ui/src/utils/server-helpers";
import { McpRegistryCard } from "./McpRegistryCard";

const toast = vi.fn();

vi.mock("@/hooks/useDomainIcon", () => ({
  useDomainIcon: () => "",
}));

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast }),
}));

const catalogServer: CatalogMCPServerConfigByNameItem = {
  id: "0190a000-0000-7000-8000-000000000001",
  name: "github",
  displayName: "GitHub",
  description: "GitHub MCP server",
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

describe("McpRegistryCard", () => {
  it("adds an uninstalled server with converted configuration", () => {
    const onAddServer = vi.fn();
    render(
      <McpRegistryCard server={catalogServer} onAddServer={onAddServer} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add GitHub" }));

    expect(toast).toHaveBeenCalledWith({
      title: "Adding github...",
      variant: "server-info",
    });
    expect(onAddServer).toHaveBeenCalledWith(
      {
        github: {
          type: "stdio",
          command: "npx",
          args: ["-y", "@example/github-mcp"],
          env: { GITHUB_TOKEN: "" },
        },
      },
      "GitHub",
      false,
      catalogServer.id,
    );
  });

  it("shows server status instead of the add button when installed", () => {
    render(
      <McpRegistryCard
        server={catalogServer}
        status="pending_auth"
        onAddServer={vi.fn()}
      />,
    );

    expect(screen.getByText("Pending Auth")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add GitHub" }),
    ).not.toBeInTheDocument();
  });
});
