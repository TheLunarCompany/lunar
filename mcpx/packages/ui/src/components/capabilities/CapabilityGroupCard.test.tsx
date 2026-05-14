import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CapabilityGroupCard } from "./CapabilityGroupCard";

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
