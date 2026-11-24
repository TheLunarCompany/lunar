import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ isBoomi: false }));

vi.mock("@/contexts/feature-flags", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useFeatureFlag: (key: string) =>
    key === "VITE_IS_BOOMI" ? harness.isBoomi : false,
}));

vi.mock("@/contexts/useAuth", () => ({
  useAuth: () => ({
    user: { name: "Ada Lovelace", email: "ada@example.com" },
    logout: vi.fn(),
  }),
}));

vi.mock("@/data/identity", () => ({
  useIdentity: () => ({ data: { identity: {} } }),
  isAdminIdentity: () => true,
  isEnterpriseIdentity: () => false,
}));

vi.mock("@/data/strictness", () => ({
  useStrictness: () => ({
    data: {
      strictnessFeatureEnabled: true,
      isStrict: true,
      adminOverride: false,
    },
    isLoading: false,
  }),
}));

vi.mock("@/components/admin/StrictModeToggle", () => ({
  StrictModeToggle: () => <div>Strict mode</div>,
}));

import { UserDetails } from "./UserDetails";

describe("UserDetails", () => {
  beforeEach(() => {
    harness.isBoomi = false;
  });

  it("shows Strict mode for self-hosted users", async () => {
    const user = userEvent.setup();
    render(<UserDetails />);

    await user.click(screen.getByRole("button"));

    expect(screen.getByText("Strict mode")).toBeInTheDocument();
  });

  it("hides Strict mode for Boomi users", async () => {
    const user = userEvent.setup();
    harness.isBoomi = true;
    render(<UserDetails />);

    await user.click(screen.getByRole("button"));

    expect(screen.queryByText("Strict mode")).not.toBeInTheDocument();
  });
});
