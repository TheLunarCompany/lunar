import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { CapabilityGroupCard } from "./CapabilityGroupCard";

function renderWithQueryClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("CapabilityGroupCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the standard Figma-backed metric icons", () => {
    render(
      <CapabilityGroupCard.Metrics>
        <CapabilityGroupCard.ToolsMetric value={24} />
        <CapabilityGroupCard.PromptsMetric value={2} />
        <CapabilityGroupCard.ResourcesMetric value={75} />
      </CapabilityGroupCard.Metrics>,
    );

    expect(screen.getByLabelText("Tools: 24")).toBeInTheDocument();
    expect(screen.getByLabelText("Prompts: 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Resources: 75")).toBeInTheDocument();
  });
});

describe("CapabilityGroupCard.ProviderBadge", () => {
  it("uses warning styling when the provider is missing or inactive", () => {
    renderWithQueryClient(
      <CapabilityGroupCard.ProviderBadge name="github" isMissingOrInactive />,
    );

    expect(
      screen.getByText("github").closest('[data-slot="badge"]'),
    ).toHaveClass(
      "border-[var(--colors-warning-300)]",
      "bg-[var(--colors-warning-50)]",
    );
  });

  it("does not render a tool count when none is provided", () => {
    renderWithQueryClient(<CapabilityGroupCard.ProviderBadge name="github" />);

    expect(screen.getByText("github")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
