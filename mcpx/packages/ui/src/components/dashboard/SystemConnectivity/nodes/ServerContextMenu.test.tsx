import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ServerContextMenu } from "./ServerContextMenu";

describe("ServerContextMenu", () => {
  it("renders details and edit actions for editable servers", () => {
    const html = renderToStaticMarkup(
      <ServerContextMenu
        isInactive={false}
        canEdit={true}
        onDetails={vi.fn()}
        onEdit={vi.fn()}
        onToggleInactive={vi.fn()}
        onDelete={vi.fn()}
        onClick={vi.fn()}
      />,
    );

    expect(html).toContain("Details");
    expect(html).toContain("Edit");
    expect(html).toContain("Deactivate");
  });

  it("omits the edit action for non-editable servers", () => {
    const html = renderToStaticMarkup(
      <ServerContextMenu
        isInactive={true}
        canEdit={false}
        onDetails={vi.fn()}
        onEdit={vi.fn()}
        onToggleInactive={vi.fn()}
        onDelete={vi.fn()}
        onClick={vi.fn()}
      />,
    );

    expect(html).toContain("Details");
    expect(html).not.toContain("Edit");
    expect(html).toContain("Activate");
  });
});
