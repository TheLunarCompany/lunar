import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { getHostedMcpEditContextFromLocation } from "./hosted-mcp-edit-context";
import { useInitialHostedMcpEditContext } from "./use-initial-hosted-mode";

vi.mock("./hosted-mcp-edit-context", () => ({
  getHostedMcpEditContextFromLocation: vi.fn(),
}));

describe("useInitialHostedMcpEditContext", () => {
  it("keeps hosted edit context from the initial URL across rerenders", () => {
    const context = {
      returnUrl: "https://mcpx-admin-stg.lunar.dev/hosted-mcp-server",
      spaceId: "space-123",
    };

    vi.mocked(getHostedMcpEditContextFromLocation)
      .mockReturnValueOnce(context)
      .mockReturnValue(null);

    const { result, rerender } = renderHook(() =>
      useInitialHostedMcpEditContext(),
    );

    expect(result.current).toBe(context);

    rerender();

    expect(result.current).toBe(context);
    expect(getHostedMcpEditContextFromLocation).toHaveBeenCalledTimes(1);
  });
});
