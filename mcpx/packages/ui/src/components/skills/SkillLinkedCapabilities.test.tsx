import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { SkillCapabilityGroup, SystemState } from "@mcpx/shared-model";
import { describe, expect, it } from "vitest";
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
    expect(screen.getByLabelText("Tools: 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Prompts: 1")).toBeInTheDocument();
  });

  it("renders nothing without linked capabilities", () => {
    const { container } = renderWithQueryClient(<SkillLinkedCapabilities />);

    expect(container).toBeEmptyDOMElement();
  });
});
