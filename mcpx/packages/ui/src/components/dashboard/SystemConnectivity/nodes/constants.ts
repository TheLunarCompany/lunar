export const NODE_HEIGHT = 109;
export const NODE_WIDTH = 200;

// Gap between nodes within a column (px)
export const ROW_GAP = 24;

// Horizontal gap between the MCPX hub and each column
// Must be wide enough to fit the add-button (32px) + gaps on both sides
export const COLUMN_GAP = 240;

// Fallback node height when measured dimensions are not yet available.
// Used only for the initial render before ReactFlow measures actual DOM sizes.
export const ESTIMATED_NODE_HEIGHT = 120;

// Maximum number of nodes stacked in a single column before wrapping
export const MAX_NODES_PER_COLUMN = 6;

// Padding between columns when wrapping (enough for curves to form)
export const COLUMN_PADDING = 120;

// MCPX hub node approximate height (doesn't need measurement - it's fixed)
export const MCP_NODE_HEIGHT = 80;

export const MCP_ICON_COLORS: string[] = [
  "#6CC2CE",
  "#3563E0",
  "#464CB0",
  "#551EE0",
  "#8C409E",
  "#E5421F",
  "#EC972A",
  "#019894",
  "#50E3C2",
  "#FF77A9",
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#FFEAA7",
  "#DDA0DD",
  "#98D8C8",
  "#F7DC6F",
  "#82E0AA",
  "#D7BDE2",
  "#F0B27A",
  "#85C1E9",
  "#F1948A",
  "#73C6B6",
  "#E59866",
  "#7FB3D8",
  "#C39BD3",
  "#7DCEA0",
  "#F0E68C",
  "#87CEEB",
  "#DDA0DD",
  "#B0E0E6",
  "#FFB6C1",
  "#90EE90",
  "#FFA07A",
  "#ADD8E6",
  "#FFE4B5",
  "#98FB98",
  "#DEB887",
  "#AFEEEE",
  "#FFDAB9",
  "#B0C4DE",
  "#FFE4E1",
  "#8FBC8F",
  "#D2B48C",
  "#66CDAA",
  "#BC8F8F",
  "#5F9EA0",
  "#DAA520",
  "#CD853F",
  "#6B8E23",
  "#708090",
];
