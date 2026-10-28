import { act, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  logout: undefined as undefined | (() => void),
  suspendPendo: vi.fn(),
}));

vi.mock("@/config/runtime-config", () => ({
  getAuthBffUrl: () => null,
  isEnterpriseEnabled: () => false,
}));

vi.mock("@/components/pendo", () => ({
  suspendPendo: harness.suspendPendo,
}));

import { AuthProvider } from "./AuthContext";
import { useAuth } from "./useAuth";

function CaptureLogout({ children }: { children?: ReactNode }) {
  harness.logout = useAuth().logout;
  return children ?? null;
}

describe("AuthProvider", () => {
  afterEach(() => {
    harness.logout = undefined;
    harness.suspendPendo.mockClear();
  });

  it("suspends Pendo when logging out", () => {
    render(
      <AuthProvider>
        <CaptureLogout />
      </AuthProvider>,
    );

    act(() => harness.logout?.());

    expect(harness.suspendPendo).toHaveBeenCalledOnce();
  });
});
