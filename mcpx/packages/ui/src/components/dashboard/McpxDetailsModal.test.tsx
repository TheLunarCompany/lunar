import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import type { McpxData } from "./SystemConnectivity/types";

const harness = vi.hoisted(() => ({ isBoomi: false }));

vi.mock("@/contexts/feature-flags", () => ({
  useFeatureFlag: (key: string) =>
    key === "VITE_IS_BOOMI" ? harness.isBoomi : false,
}));

vi.mock("@/store", () => ({
  useSocketStore: (
    selector: (state: {
      systemState: { targetServers: [] };
      appConfig: null;
    }) => unknown,
  ) =>
    selector({
      systemState: { targetServers: [] },
      appConfig: null,
    }),
}));

vi.mock("@/data/saved-setups", () => ({
  useResetSetup: () => ({ mutate: vi.fn() }),
  useSaveSetup: () => ({ mutate: vi.fn() }),
}));

vi.mock("@/data/mcp-server", () => ({
  useSetTargetServerActive: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => vi.fn(),
}));

vi.mock("@/components/ui/use-toast", () => ({
  toast: vi.fn(),
  useToast: () => ({ dismiss: vi.fn() }),
}));

import { McpxDetailsModal } from "./McpxDetailsModal";

const mcpxData = {
  version: "1.2.3-build.4",
  status: "running",
} as McpxData;

describe("McpxDetailsModal", () => {
  beforeEach(() => {
    harness.isBoomi = false;
  });

  it("shows the version badge for self-hosted users", () => {
    render(
      <TooltipProvider>
        <McpxDetailsModal mcpxData={mcpxData} isOpen onClose={vi.fn()} />
      </TooltipProvider>,
    );

    expect(screen.getByText("Version 1.2.3")).toBeInTheDocument();
  });

  it("hides the version badge for Boomi users", () => {
    harness.isBoomi = true;
    render(
      <TooltipProvider>
        <McpxDetailsModal mcpxData={mcpxData} isOpen onClose={vi.fn()} />
      </TooltipProvider>,
    );

    expect(screen.queryByText("Version 1.2.3")).not.toBeInTheDocument();
  });
});
