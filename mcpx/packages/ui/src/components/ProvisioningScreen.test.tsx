import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProvisioningScreen } from "./ProvisioningScreen";

describe("ProvisioningScreen", () => {
  it("explains that the request is awaiting administrator approval", () => {
    render(<ProvisioningScreen />);

    expect(screen.getByTestId("approval-pending-screen")).toHaveAttribute(
      "data-instance-status",
      "approval-pending",
    );
    expect(screen.getByTestId("approval-pending-badge")).toHaveTextContent(
      "AWAITING APPROVAL",
    );
    expect(
      screen.getByRole("heading", {
        name: "Your MCPX request is awaiting approval",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "An administrator needs to approve your request before we can create your workspace. We’ll connect you automatically once it’s ready.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Checking for approval")).toBeInTheDocument();
  });
});
