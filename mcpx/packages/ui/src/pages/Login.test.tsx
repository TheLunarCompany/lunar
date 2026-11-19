import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
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

function renderAtLogin(): void {
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/" element={<div>home marker</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

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
    renderAtLogin();

    const heading = screen.getByRole("heading", { name: "Login is disabled" });

    expect(heading.parentElement).toHaveClass("bg-mcpx-surface");
    expect(heading.parentElement?.parentElement).toHaveClass(
      "items-center",
      "justify-center",
      "bg-mcpx-page",
    );
    expect(mocks.login).not.toHaveBeenCalled();
    expect(screen.queryByText("home marker")).toBeNull();
  });

  it("sends a signed-in user home", () => {
    Object.assign(mocks.auth, { loginRequired: true, isAuthenticated: true });

    renderAtLogin();

    expect(screen.getByText("home marker")).toBeInTheDocument();
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it("starts login for a signed-out user and stays on the page", () => {
    Object.assign(mocks.auth, { loginRequired: true, isAuthenticated: false });

    renderAtLogin();

    expect(mocks.login).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("home marker")).toBeNull();
    expect(screen.getByText("Redirecting to sign in...")).toBeInTheDocument();
  });
});
