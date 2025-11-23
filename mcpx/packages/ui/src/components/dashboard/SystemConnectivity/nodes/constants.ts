export const NODE_HEIGHT = 109;
export const NODE_WIDTH = 200; // Increased from 150 to make server nodes wider

// Zero state positioning constants
export const ZERO_STATE_GAP = 80;
export const ZERO_STATE_BLOCK_WIDTH = 245;
export const ZERO_STATE_PADDING = 16;

// Node height constants
export const ZERO_STATE_NODE_HEIGHT = 140;
export const MCP_NODE_HEIGHT = 93;
export const SERVER_NODE_HEIGHT = 56;

// Server node positioning constants
export const SERVER_NODE_INITIAL_GAP = 180; // Initial gap from MCPX node
export const SERVER_NODE_VERTICAL_SPACING = 48; // Vertical spacing between server nodes (16 * 3)

// Agent node positioning constants
export const AGENT_NODE_GAP = 130; // Gap between agent nodes and MCPX node
export const AGENT_NODE_WIDTH = 120; // Width of agent nodes

// Y offset arrays for different node counts per column
// Pattern: Index 0 aligned with MCPX (0), then alternating up/down
export const SERVER_GRID_Y_OFFSETS_1 = [0]; // 1 node: centered on MCPX

export const SERVER_GRID_Y_OFFSETS_2 = [
    SERVER_NODE_HEIGHT, // Index 0: aligned with MCPX
  -SERVER_NODE_HEIGHT, // Index 1: up
]; // 2 nodes

export const SERVER_GRID_Y_OFFSETS_3 = [
  0, // Index 0: aligned with MCPX
  -SERVER_NODE_HEIGHT*2, // Index 1: up
  SERVER_NODE_HEIGHT * 2, // Index 2: down
]; // 3 nodes

export const SERVER_GRID_Y_OFFSETS_4 = [
SERVER_NODE_HEIGHT, // Index 0: aligned with MCPX
  -SERVER_NODE_HEIGHT , // Index 1: up
  SERVER_NODE_HEIGHT * 3, // Index 2: down
  -SERVER_NODE_HEIGHT * 3, // Index 3: up
]; // 4 nodes

export const SERVER_GRID_Y_OFFSETS_5 = [
  0, // Index 0: aligned with MCPX
  -SERVER_NODE_HEIGHT *2, // Index 1: up
  SERVER_NODE_HEIGHT * 2, // Index 2: down
  -SERVER_NODE_HEIGHT * 4, // Index 3: up
  SERVER_NODE_HEIGHT * 4, // Index 4: down
]; // 5 nodes

export const SERVER_GRID_Y_OFFSETS_6 = [
SERVER_NODE_HEIGHT , // Index 0: aligned with MCPX
  -SERVER_NODE_HEIGHT , // Index 1: up
  SERVER_NODE_HEIGHT * 3, // Index 2: down
  -SERVER_NODE_HEIGHT * 3, // Index 3: up
  SERVER_NODE_HEIGHT * 5, // Index 4: down
  -SERVER_NODE_HEIGHT * 5, // Index 5: up
]; // 6 nodes

// Legacy constant for backward compatibility (defaults to 6 nodes)
export const SERVER_GRID_Y_OFFSETS = SERVER_GRID_Y_OFFSETS_6;

/**
 * Get Y offsets for server nodes based on the number of nodes in the column
 * @param nodeCount - Number of nodes in the column (1-6)
 * @returns Array of Y offsets relative to MCPX center, sorted from top to bottom
 */
export const getServerGridYOffsets = (nodeCount: number): number[] => {
  let offsets: number[];
  switch (nodeCount) {
    case 1:
      offsets = SERVER_GRID_Y_OFFSETS_1;
      break;
    case 2:
      offsets = SERVER_GRID_Y_OFFSETS_2;
      break;
    case 3:
      offsets = SERVER_GRID_Y_OFFSETS_3;
      break;
    case 4:
      offsets = SERVER_GRID_Y_OFFSETS_4;
      break;
    case 5:
      offsets = SERVER_GRID_Y_OFFSETS_5;
      break;
    case 6:
      offsets = SERVER_GRID_Y_OFFSETS_6;
      break;
    default:
      // Fallback to 6 nodes if count is out of range
      offsets = SERVER_GRID_Y_OFFSETS_6;
  }
  // Sort offsets from top (most negative) to bottom (most positive)
  return [...offsets].sort((a, b) => a - b);
};




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
    "#DD4563",
    "#07C8F9",
    "#553B29",
    "#B8B8B8",
    "#FFD600",
    "#00C896",
    "#955FA6",
    "#3A474E",
    "#2C3E50",
    "#E67E22",
    "#1ABC9C",
    "#9B59B6",
    "#F39C12",
    "#E74C3C",
    "#7F8C8D",
    "#34495E",
    "#27AE60",
    "#F1C40F",
    "#E84393",
    "#D35400",
    "#EA8685",
    "#574B90",
    "#303952",
    "#B53471",
    "#218C5A",
    "#6D214F",
    "#D6A2E8",
    "#32FF7A",
    "#2D3436",
    "#FFD6E0",
    "#EAFFA6",
    "#FFABAB",
    "#B5FFD9",
    "#A1C4FD",
    "#C2FFD9",
    "#C471F5",
    "#FD6E6A",
    "#00B894",
    "#00B8D4",
    "#A3CB38",
    "#706FD3",
    "#9D50BB",
    "#5F2C82",
    "#48C6EF"
];
