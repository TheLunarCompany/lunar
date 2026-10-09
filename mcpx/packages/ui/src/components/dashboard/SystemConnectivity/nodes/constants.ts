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
