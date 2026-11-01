import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginRoute } from "./Login";

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  auth: {
    loading: false,
    error: null,
    loginRequired: false,
    isAuthenticated: false,
  },
}));

vi.mock("@/contexts/useAuth", () => ({
  useAuth: () => ({ ...mocks.auth, login: mocks.login }),
}));

describe("LoginRoute", () => {
  beforeEach(() => {
    mocks.login.mockClear();
    Object.assign(mocks.auth, {
      loading: false,
      error: null,
      loginRequired: false,
      isAuthenticated: false,
    });
  });

  it("renders the disabled state as a centered semantic panel", () => {
    render(<LoginRoute />);

    const heading = screen.getByRole("heading", { name: "Login is disabled" });

    expect(heading.parentElement).toHaveClass("bg-mcpx-surface");
    expect(heading.parentElement?.parentElement).toHaveClass(
      "items-center",
      "justify-center",
      "bg-mcpx-page",
    );
    expect(mocks.login).not.toHaveBeenCalled();
  });
});
