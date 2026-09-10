import { describe, expect, it } from "vitest";

import { calculateContextMenuPosition } from "./context-menu-position";

describe("calculateContextMenuPosition", () => {
  it("uses pane-relative coordinates when deciding whether to anchor from the top and left", () => {
    const position = calculateContextMenuPosition({
      clientX: 350,
      clientY: 230,
      pane: {
        left: 100,
        top: 80,
        width: 500,
        height: 400,
      },
    });

    expect(position).toEqual({
      top: 150,
      left: 250,
      right: false,
      bottom: false,
    });
  });

  it("anchors from the right and bottom when the pane-relative click is near those edges", () => {
    const position = calculateContextMenuPosition({
      clientX: 450,
      clientY: 330,
      pane: {
        left: 100,
        top: 80,
        width: 500,
        height: 400,
      },
    });

    expect(position).toEqual({
      top: false,
      left: false,
      right: 150,
      bottom: 150,
    });
  });
});
