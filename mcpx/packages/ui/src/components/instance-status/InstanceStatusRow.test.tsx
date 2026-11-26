import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InstanceStatusRow } from "./InstanceStatusRow";

describe("InstanceStatusRow", () => {
  it("renders the current state", () => {
    render(<InstanceStatusRow status="working" />);

    const status = screen.getByRole("status");

    expect(status).toHaveTextContent("Working");
    expect(status).toHaveTextContent("Processing active calls");
    expect(status).toHaveClass("bg-[var(--mcpx-sidebar-active)]");
  });
});
