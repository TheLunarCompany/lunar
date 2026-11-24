import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMcpxProbe } from "./useMcpxProbe";

const mocks = vi.hoisted(() => ({ enterpriseEnabled: true }));

vi.mock("@/config/runtime-config", () => ({
  getRuntimeConfigSync: () => ({
    VITE_ENABLE_ENTERPRISE: mocks.enterpriseEnabled ? "true" : "false",
  }),
}));

vi.mock("@/config/api-config", () => ({
  getMcpxServerURL: (transport: string) => `http://mcpx.test/${transport}`,
}));

const response = (body: unknown, status: number): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

describe("useMcpxProbe", () => {
  beforeEach(() => {
    mocks.enterpriseEnabled = true;
    vi.restoreAllMocks();
  });

  it("does not request while disabled", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMcpxProbe({ enabled: false }), {
      wrapper,
    });

    expect(result.current.state).toEqual({ type: "checking" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips the probe outside enterprise mode", () => {
    mocks.enterpriseEnabled = false;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMcpxProbe(), { wrapper });

    expect(result.current.state).toEqual({ type: "ready" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps an authenticated response to ready", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ status: "authenticated" }, 200)),
    );

    const { result } = renderHook(() => useMcpxProbe(), { wrapper });

    await waitFor(() =>
      expect(result.current.state).toEqual({ type: "ready" }),
    );
  });

  it.each([
    [{ data: { instanceStatus: "failing" } }, "error"],
    [{ data: { instanceStatus: "initializing" } }, "initializing"],
    [{ error: "Provisioning in progress" }, "initializing"],
  ] as const)("maps a 503 response to %s", async (body, status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(body, 503)));

    const { result } = renderHook(() => useMcpxProbe(), { wrapper });

    await waitFor(() =>
      expect(result.current.state).toEqual({ type: "instance", status }),
    );
  });

  it("keeps pending admin approval distinct from initialization", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          response({ data: { instanceStatus: "approval-pending" } }, 503),
        ),
    );

    const { result } = renderHook(() => useMcpxProbe(), { wrapper });

    await waitFor(() =>
      expect(result.current.state).toEqual({ type: "approval-pending" }),
    );
  });

  it("shows the gateway as unavailable when the probe request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );

    const { result } = renderHook(() => useMcpxProbe(), { wrapper });

    await waitFor(() =>
      expect(result.current.state).toEqual({ type: "gateway-unavailable" }),
    );
  });

  it("fails closed for an unknown explicit instance status", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          response({ data: { instanceStatus: "unexpected" } }, 503),
        ),
    );

    const { result } = renderHook(() => useMcpxProbe(), { wrapper });

    await waitFor(() =>
      expect(result.current.state).toEqual({ type: "gateway-unavailable" }),
    );
  });

  it("starts one recovery request when the gateway is unauthenticated", async () => {
    const fetchMock = vi.fn((_url: RequestInfo | URL, init?: RequestInit) =>
      Promise.resolve(
        init?.method === "POST"
          ? response({ status: "accepted" }, 202)
          : response({ status: "unauthenticated" }, 200),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMcpxProbe(), { wrapper });

    await waitFor(() =>
      expect(result.current.state).toEqual({ type: "gateway-unavailable" }),
    );
    expect(
      fetchMock.mock.calls.filter(([, init]) => init?.method === "POST"),
    ).toHaveLength(1);
  });

  it("retries recovery after the cooldown while the gateway stays unauthenticated", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000);
    const fetchMock = vi.fn((_url: RequestInfo | URL, init?: RequestInit) =>
      Promise.resolve(
        init?.method === "POST"
          ? response({ status: "accepted" }, 202)
          : response({ status: "unauthenticated" }, 200),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMcpxProbe(), { wrapper });

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([, init]) => init?.method === "POST"),
      ).toHaveLength(1),
    );

    now.mockReturnValue(11_000);
    act(() => result.current.refresh());

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([, init]) => init?.method === "POST"),
      ).toHaveLength(2),
    );
  });

  it("returns the server message for authorization failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ error: "Access denied" }, 403)),
    );

    const { result } = renderHook(() => useMcpxProbe(), { wrapper });

    await waitFor(() =>
      expect(result.current.state).toEqual({
        type: "unauthorized",
        message: "Access denied",
      }),
    );
  });
});

function wrapper({ children }: PropsWithChildren) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
