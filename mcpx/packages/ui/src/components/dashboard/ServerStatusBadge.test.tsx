import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ServerStatusBadge } from "./ServerStatusBadge";
import { McpServerStatus } from "@/types";

describe("ServerStatusBadge", () => {
  it("renders the redesigned active status badge", () => {
    const html = renderToStaticMarkup(
      <ServerStatusBadge status="connected_running" />,
    );

    expect(html).toContain(">Active</span>");
    expect(html).toContain("border-0");
    expect(html).not.toContain("shadow-[0_0_0_3px");
  });

  it.each<McpServerStatus>([
    "connecting",
    "connected_stopped",
    "connected_inactive",
    "connection_failed",
    "pending_auth",
    "pending_input",
  ])("renders without a border for %s", (status) => {
    const html = renderToStaticMarkup(<ServerStatusBadge status={status} />);

    expect(html).toContain("border-0");
    expect(html).not.toContain("border-mcpx-");
  });

  it("renders a disabled presentation badge", () => {
    const html = renderToStaticMarkup(<ServerStatusBadge status="disabled" />);

    expect(html).toContain(">Disabled</span>");
    expect(html).toContain("bg-mcpx-surface-disabled");
  });
});
