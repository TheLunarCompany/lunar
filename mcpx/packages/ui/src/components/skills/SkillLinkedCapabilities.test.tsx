import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { SkillCapabilityGroup, SystemState } from "@mcpx/shared-model";
import { describe, expect, it, vi } from "vitest";
import { SkillLinkedCapabilities } from "./SkillLinkedCapabilities";

const capabilityGroup: SkillCapabilityGroup = {
  name: "Browser tools",
  items: [
    {
      catalogItemId: "0190a000-0000-7000-8000-000000000010",
      tools: "*",
      prompts: ["inspect_page"],
    },
    {
      catalogItemId: "0190a000-0000-7000-8000-000000000011",
      tools: ["actions_read"],
      prompts: [],
    },
  ],
};

const systemState = {
  targetServers: [
    {
      catalogItemId: "0190a000-0000-7000-8000-000000000010",
      name: "browser",
      tools: [{ name: "browser_open" }, { name: "browser_click" }],
      prompts: [{ name: "inspect_page" }],
    },
    {
      catalogItemId: "0190a000-0000-7000-8000-000000000011",
      name: "github",
      tools: [{ name: "actions_read" }],
      prompts: [],
    },
  ],
} as SystemState;

function renderWithQueryClient(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("SkillLinkedCapabilities", () => {
  it("renders linked providers and capability metrics", () => {
    renderWithQueryClient(
      <SkillLinkedCapabilities
        capabilityGroup={capabilityGroup}
        systemState={systemState}
      />,
    );

    expect(screen.getByText("Linked MCP capabilities")).toBeInTheDocument();
    expect(screen.getByText("browser")).toBeInTheDocument();
    expect(screen.getByText("3 linked")).toBeInTheDocument();
    expect(screen.getByText("browser_open")).toBeInTheDocument();
    expect(screen.getByText("browser_click")).toBeInTheDocument();
    expect(screen.getByText("inspect_page")).toBeInTheDocument();
    expect(screen.getByText("github")).toBeInTheDocument();
    expect(document.querySelector('img[src*="github"]')).toBeInTheDocument();
    expect(screen.getByText("actions_read")).toBeInTheDocument();
    expect(screen.getByLabelText("Tools: 3")).toBeInTheDocument();
    expect(screen.getByLabelText("Prompts: 1")).toBeInTheDocument();
  });

  it("shows an unresolved state instead of raw catalog ids or wildcard markers", () => {
    const unresolvedCatalogItemId = "0190a000-0000-7000-8000-000000000099";

    renderWithQueryClient(
      <SkillLinkedCapabilities
        capabilityGroup={{
          name: "Unavailable tools",
          items: [
            {
              catalogItemId: unresolvedCatalogItemId,
              tools: "*",
              prompts: "*",
            },
          ],
        }}
        systemState={{ ...systemState, targetServers: [] }}
      />,
    );

    expect(screen.getByText("Linked MCP capabilities")).toBeInTheDocument();
    expect(screen.getByText("Unavailable MCP server")).toBeInTheDocument();
    expect(
      screen.getByText("Capability details unavailable"),
    ).toBeInTheDocument();
    expect(screen.getByText("1 unavailable")).toBeInTheDocument();
    expect(screen.queryByText(unresolvedCatalogItemId)).not.toBeInTheDocument();
    expect(screen.queryByText("*")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Tools: 0")).toBeInTheDocument();
    expect(screen.getByLabelText("Prompts: 0")).toBeInTheDocument();
  });

  it("renders nothing without linked capabilities", () => {
    const { container } = renderWithQueryClient(<SkillLinkedCapabilities />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders an empty state when requested without linked capabilities", () => {
    const onEdit = vi.fn();
    const { container } = renderWithQueryClient(
      <SkillLinkedCapabilities showEmptyState onEdit={onEdit} />,
    );

    expect(screen.getByText("No MCP servers available")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Add an MCP server to make tools and prompts available for this skill.",
      ),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[aria-hidden="true"] svg'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(onEdit).toHaveBeenCalledOnce();
  });
});
