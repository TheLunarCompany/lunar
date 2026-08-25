import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ServerCapabilitiesSections } from "./ServerDetailsModal";
import type { McpServer } from "@/types";

vi.mock("@/config/runtime-config", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/config/runtime-config")>();
  return {
    ...actual,
    isCapabilitiesEnabled: () => false,
  };
});

const server: McpServer = {
  args: [],
  command: "",
  id: "server-docs",
  name: "docs",
  status: "connected_stopped",
  tools: [
    {
      name: "search-docs",
      description: "Search docs.",
      invocations: 0,
    },
  ],
  prompts: [
    {
      name: "draft-docs-answer",
      description: "Draft an answer from docs.",
      invocations: 0,
    },
  ],
  usage: {
    callCount: 0,
  },
  type: "stdio",
};

describe("ServerCapabilitiesSections", () => {
  it("hides prompts when the capabilities UI flag is disabled", () => {
    render(<ServerCapabilitiesSections server={server} />);

    expect(screen.getByText("Tools (1)")).toBeInTheDocument();
    expect(screen.queryByText("Prompts (1)")).toBeNull();
  });
});
