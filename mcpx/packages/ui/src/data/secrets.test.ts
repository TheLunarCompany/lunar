import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import {
  createElement,
  type PropsWithChildren,
  useEffect,
  useState,
} from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FeatureFlagsProvider } from "@/contexts/FeatureFlagsContext";
import { useFeatureFlags } from "@/contexts/feature-flags";
import { apiClient } from "@/lib/api";
import { fetchSecrets, sortSecrets, useGetSecrets } from "./secrets";

function createWrapper(isBoomi: boolean) {
  function FeatureFlagSetup({ children }: PropsWithChildren) {
    const { resetFeatureFlagOverride, setFeatureFlagOverride } =
      useFeatureFlags();

    return createElement(
      FeatureFlagSetupContent,
      {
        isBoomi,
        resetFeatureFlagOverride,
        setFeatureFlagOverride,
      },
      children,
    );
  }

  function FeatureFlagSetupContent({
    children,
    isBoomi: shouldEnableBoomi,
    resetFeatureFlagOverride,
    setFeatureFlagOverride,
  }: PropsWithChildren<{
    isBoomi: boolean;
    resetFeatureFlagOverride: (key: "VITE_IS_BOOMI") => void;
    setFeatureFlagOverride: (key: "VITE_IS_BOOMI", value: boolean) => void;
  }>) {
    const [ready, setReady] = useState(false);

    useEffect(() => {
      if (shouldEnableBoomi) {
        setFeatureFlagOverride("VITE_IS_BOOMI", true);
      } else {
        resetFeatureFlagOverride("VITE_IS_BOOMI");
      }
      setReady(true);
      // The flag is set once before the query hook is mounted.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return ready ? children : null;
  }

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: PropsWithChildren) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
        FeatureFlagsProvider,
        null,
        createElement(FeatureFlagSetup, null, children),
      ),
    );
  };
}

describe("secrets runtime data", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the real API response even when it is empty", async () => {
    vi.spyOn(apiClient, "getSecrets").mockResolvedValue([]);

    await expect(fetchSecrets()).resolves.toEqual([]);
  });

  it("propagates API errors instead of falling back to mock secrets", async () => {
    const error = new Error("network down");
    vi.spyOn(apiClient, "getSecrets").mockRejectedValue(error);

    await expect(fetchSecrets()).rejects.toThrow("network down");
  });

  it("sorts secrets alphabetically", () => {
    expect(sortSecrets(["STRIPE_SECRET", "API_TOKEN", "DB_PASSWORD"])).toEqual([
      "API_TOKEN",
      "DB_PASSWORD",
      "STRIPE_SECRET",
    ]);
  });

  it("does not fetch secrets when the Boomi flag is enabled", async () => {
    const getSecrets = vi.spyOn(apiClient, "getSecrets").mockResolvedValue([]);

    renderHook(() => useGetSecrets(), { wrapper: createWrapper(true) });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getSecrets).not.toHaveBeenCalled();
  });

  it("fetches secrets when the Boomi flag is disabled", async () => {
    const getSecrets = vi
      .spyOn(apiClient, "getSecrets")
      .mockResolvedValue(["ZETA", "ALPHA"]);

    const { result } = renderHook(() => useGetSecrets(), {
      wrapper: createWrapper(false),
    });

    await waitFor(() => expect(result.current.data).toEqual(["ALPHA", "ZETA"]));
    expect(getSecrets).toHaveBeenCalledTimes(1);
  });
});
