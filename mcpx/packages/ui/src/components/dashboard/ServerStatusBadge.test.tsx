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
    expect(html).toContain("border-(--color-border-success)");
    expect(html).not.toContain("shadow-[0_0_0_3px");
  });

  it.each<[McpServerStatus, string]>([
    ["connecting", "border-(--colors-gray-200)"],
    ["connected_stopped", "border-(--color-border-success)"],
    ["connected_inactive", "border-(--colors-primary-200)"],
    ["connection_failed", "border-(--colors-error-200)"],
    ["pending_auth", "border-(--colors-info-200)"],
    ["pending_input", "border-(--colors-warning-200)"],
  ])("renders a semantic border for %s", (status, borderClass) => {
    const html = renderToStaticMarkup(<ServerStatusBadge status={status} />);

    expect(html).toContain(borderClass);
  });
});
