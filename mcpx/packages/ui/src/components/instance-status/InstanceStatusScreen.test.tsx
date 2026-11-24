import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InstanceStatusScreen } from "./InstanceStatusScreen";

describe("InstanceStatusScreen", () => {
  it.each([
    ["initializing", "Preparing your MCPX workspace"],
    ["error", "MCPX needs attention"],
    ["offline", "MCPX is offline"],
  ] as const)("renders the %s panel", (status, title) => {
    render(<InstanceStatusScreen status={status} />);

    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
  });
});
