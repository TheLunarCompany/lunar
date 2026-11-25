import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useBoomiAccount } from "./useBoomiAccount";

const harness = vi.hoisted(() => ({
  authBffUrl: "https://auth-bff.test",
  enabled: true,
  authenticated: true,
  loading: false,
}));

vi.mock("@/config/runtime-config", () => ({
  getAuthBffUrl: () => harness.authBffUrl,
  isPendoEnabled: () => harness.enabled,
}));

vi.mock("@/contexts/useAuth", () => ({
  useAuth: () => ({
    isAuthenticated: harness.authenticated,
    loading: harness.loading,
  }),
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  harness.authBffUrl = "https://auth-bff.test";
  harness.enabled = true;
  harness.authenticated = true;
  harness.loading = false;
});

describe("useBoomiAccount", () => {
  it("requests the runtime session with cookies and no retries", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(response({ accountId: "acct-1" }, 200));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useBoomiAccount(), { wrapper });

    await waitFor(() =>
      expect(result.current.data).toEqual({ accountId: "acct-1" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://auth-bff.test/runtime/boomi/session",
      { credentials: "include" },
    );
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("returns no account for a response without a usable account ID", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({}, 200)));
    const { result } = renderHook(() => useBoomiAccount(), { wrapper });

    await waitFor(() => expect(result.current.data).toBeNull());
  });

  it.each([
    [false, true, false],
    [true, false, false],
    [true, true, true],
  ])(
    "does not request without enabled authenticated state",
    (enabled, authenticated, loading) => {
      harness.enabled = enabled;
      harness.authenticated = authenticated;
      harness.loading = loading;
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      renderHook(() => useBoomiAccount(), { wrapper });

      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
});

function response(body: unknown, status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response;
}

function wrapper({ children }: PropsWithChildren) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
