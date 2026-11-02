import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useIdentity } from "@/data/identity";
import { OboEditBanner } from "./OboEditBanner";

vi.mock("@/data/identity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/data/identity")>();
  return { ...actual, useIdentity: vi.fn() };
});

vi.mock("@/config/api-config", () => ({
  getAdminWebserverURL: () => "https://admin.example.com",
}));

type IdentityResult = ReturnType<typeof useIdentity>;

function editedSpace(
  spaceKind: "HOSTED_MCP_SERVER" | "SANDBOX_ANALYSIS",
): IdentityResult {
  return {
    data: {
      identity: {
        mode: "enterprise",
        entity: {
          entityType: "space",
          spaceKind,
          spaceName: "Payments",
          editedBy: { adminDisplayName: "Alice" },
        },
      },
    },
  } as IdentityResult;
}

describe("OboEditBanner", () => {
  beforeEach(() => {
    vi.mocked(useIdentity).mockReset();
  });

  it("tells the admin a catalog scan is waiting for their authorization", () => {
    vi.mocked(useIdentity).mockReturnValue(editedSpace("SANDBOX_ANALYSIS"));
    render(<OboEditBanner exitObo={async () => {}} />);

    expect(
      screen.getByText(/A catalog scan is waiting for authorization by/),
    ).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(
      screen.getByText(/This MCPX is locked until it finishes/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/is currently being edited/)).toBeNull();
  });

  it("cancels the authorization through the OBO exit", async () => {
    vi.mocked(useIdentity).mockReturnValue(editedSpace("SANDBOX_ANALYSIS"));
    const exitObo = vi.fn(async () => {});
    render(<OboEditBanner exitObo={exitObo} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Cancel authorization" }),
    );

    await waitFor(() => expect(exitObo).toHaveBeenCalledOnce());
    expect(
      screen.getByRole("button", { name: "Cancelling..." }),
    ).toBeDisabled();
  });

  it("keeps the editing text and End editing for a hosted MCP server", () => {
    vi.mocked(useIdentity).mockReturnValue(editedSpace("HOSTED_MCP_SERVER"));
    render(<OboEditBanner exitObo={async () => {}} />);

    expect(
      screen.getByText(/is currently being edited by/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "End editing" }),
    ).toBeInTheDocument();
  });
});
