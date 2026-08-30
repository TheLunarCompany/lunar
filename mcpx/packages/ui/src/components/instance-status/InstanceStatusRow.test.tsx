import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InstanceStatusRow } from "./InstanceStatusRow";

describe("InstanceStatusRow", () => {
  it("renders the current state", () => {
    render(<InstanceStatusRow status="working" />);

    expect(screen.getByRole("status")).toHaveTextContent("Working");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Processing active calls",
    );
  });
});
