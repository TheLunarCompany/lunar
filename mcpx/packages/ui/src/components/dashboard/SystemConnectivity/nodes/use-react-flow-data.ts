import { Agent, McpServer } from "@/types";
import { isActive } from "@/utils";
import {
  Edge,
  Node,
  OnEdgesChange,
  OnNodesChange,
  useEdgesState,
  useNodesState,
  useNodesInitialized,
  useReactFlow,
} from "@xyflow/react";
import { CoordinateExtent } from "@xyflow/system";
import { useCallback, useEffect, useRef } from "react";
import { useSocketStore } from "@/store";

import {
  AgentNode,
  McpServerNode,
  McpxNode,
  NoAgentsNode,
  NoServersNode,
} from "../types";
import {
  COLUMN_GAP,
  COLUMN_PADDING,
  ESTIMATED_NODE_HEIGHT,
  MAX_NODES_PER_COLUMN,
  MCP_NODE_HEIGHT,
  NODE_HEIGHT,
  NODE_WIDTH,
  ROW_GAP,
} from "./constants";
import { SERVER_STATUS } from "@/types/mcp-server";
import { getMeasuredNodeLayoutKey } from "./measured-node-layout-key";

const REBUILD_DEBOUNCE_MS = 200;

const NODE_TRANSITION_STYLE = {
  transition: "transform 0.25s ease-out",
} as const;

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

type MeasuredMap = Map<string, { width: number; height: number }>;

type NodeLayoutInfo = {
  x: number;
  y: number;
  column: number;
  nodesInColumn: number;
};

function buildMeasuredMap(rfNodes: Node[]): MeasuredMap {
  const map: MeasuredMap = new Map();
  for (const n of rfNodes) {
    map.set(n.id, {
      width: n.measured?.width ?? NODE_WIDTH,
      height: n.measured?.height ?? ESTIMATED_NODE_HEIGHT,
    });
  }
  return map;
}

/**
 * Half the vertical gap left at y=0 for the trunk line.
 * Total corridor = TRUNK_CLEARANCE * 2 = ROW_GAP, matching node spacing.
 */
const TRUNK_CLEARANCE = ROW_GAP / 2;

/**
 * Stack a vertical run of nodes starting from `startY`, going downward.
 * Returns the Y after the last node (for chaining).
 */
function placeRun(
  ids: string[],
  measured: MeasuredMap,
  x: number,
  startY: number,
  direction: "left" | "right",
  column: number,
  totalInColumn: number,
  out: Map<string, NodeLayoutInfo>,
): number {
  let y = startY;
  for (const id of ids) {
    const w = measured.get(id)?.width ?? NODE_WIDTH;
    const h = measured.get(id)?.height ?? ESTIMATED_NODE_HEIGHT;
    const adjustedX = direction === "left" ? x - w : x;
    out.set(id, { x: adjustedX, y, column, nodesInColumn: totalInColumn });
    y += h + ROW_GAP;
  }
  return y;
}

/**
 * Stack nodes into columns, split above/below y=0 so the horizontal
 * trunk line at the hub's Y level never crosses any node.
 *
 * Layout per column:
 *   ┌── node (above half)  ──┐
 *   │   ...                   │   ← stacked upward from -TRUNK_CLEARANCE
 *   ├─────── y = 0 ──────────┤   ← clear corridor for trunk lines
 *   │   ...                   │   ← stacked downward from +TRUNK_CLEARANCE
 *   └── node (below half)  ──┘
 */
function stackColumn(
  nodeIds: string[],
  measured: MeasuredMap,
  baseX: number,
  direction: "left" | "right",
): Map<string, NodeLayoutInfo> {
  const positions = new Map<string, NodeLayoutInfo>();
  if (nodeIds.length === 0) return positions;

  const totalColumns = Math.ceil(nodeIds.length / MAX_NODES_PER_COLUMN);

  for (let col = 0; col < totalColumns; col++) {
    const start = col * MAX_NODES_PER_COLUMN;
    const end = Math.min(start + MAX_NODES_PER_COLUMN, nodeIds.length);
    const columnIds = nodeIds.slice(start, end);
    const n = columnIds.length;

    // X position for this column
    const colWidth = Math.max(
      ...columnIds.map((id) => measured.get(id)?.width ?? NODE_WIDTH),
    );
    const colOffset = col * (colWidth + COLUMN_PADDING);
    const x = direction === "right" ? baseX + colOffset : baseX - colOffset;

    if (n === 1) {
      // Single node: centre it vertically on the hub
      const id = columnIds[0];
      const h = measured.get(id)?.height ?? ESTIMATED_NODE_HEIGHT;
      const w = measured.get(id)?.width ?? NODE_WIDTH;
      const adjustedX = direction === "left" ? x - w : x;
      positions.set(id, {
        x: adjustedX,
        y: -h / 2,
        column: col,
        nodesInColumn: n,
      });
      continue;
    }

    // Split: first half goes above y=0, second half below
    const aboveCount = Math.ceil(n / 2);
    const aboveIds = columnIds.slice(0, aboveCount);
    const belowIds = columnIds.slice(aboveCount);

    // Place above group: stack upward from -TRUNK_CLEARANCE
    // We need total height of above group to know where to start
    const aboveHeights = aboveIds.map(
      (id) => measured.get(id)?.height ?? ESTIMATED_NODE_HEIGHT,
    );
    const aboveTotalHeight =
      aboveHeights.reduce((sum, h) => sum + h, 0) +
      ROW_GAP * (aboveIds.length - 1);
    const aboveStartY = -TRUNK_CLEARANCE - aboveTotalHeight;

    placeRun(aboveIds, measured, x, aboveStartY, direction, col, n, positions);

    // Place below group: stack downward from +TRUNK_CLEARANCE
    placeRun(
      belowIds,
      measured,
      x,
      TRUNK_CLEARANCE,
      direction,
      col,
      n,
      positions,
    );
  }

  return positions;
}

// ---------------------------------------------------------------------------
// Sorting helpers
// ---------------------------------------------------------------------------

function getStatusPriority(status: string): number {
  if (
    status === SERVER_STATUS.connected_running ||
    status === SERVER_STATUS.connected_stopped ||
    status === SERVER_STATUS.connected_inactive
  )
    return 0;
  if (
    status === SERVER_STATUS.pending_auth ||
    status === SERVER_STATUS.pending_input
  )
    return 1;
  if (status === SERVER_STATUS.connection_failed) return 2;
  return 3;
}

function sortServers(
  servers: McpServer[],
  appConfig: {
    targetServerAttributes?: Record<string, { inactive?: boolean }>;
  } | null,
): McpServer[] {
  return [...servers].sort((a, b) => {
    const isAInactive =
      appConfig?.targetServerAttributes?.[a.name]?.inactive === true;
    const isBInactive =
      appConfig?.targetServerAttributes?.[b.name]?.inactive === true;
    if (isAInactive && !isBInactive) return 1;
    if (!isAInactive && isBInactive) return -1;

    const pa = getStatusPriority(a.status);
    const pb = getStatusPriority(b.status);
    if (pa !== pb) return pa - pb;

    return a.name.localeCompare(b.name);
  });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useReactFlowData = ({
  agents,
  mcpxStatus,
  mcpServersData,
  version,
}: {
  agents: Array<Agent>;
  mcpxStatus: string;
  mcpServersData: Array<McpServer> | null | undefined;
  version?: string;
}): {
  edges: Edge[];
  nodes: Node[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  translateExtent?: CoordinateExtent;
} => {
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);

  const { getNodes } = useReactFlow();
  const nodesInitialized = useNodesInitialized();

  const { appConfig } = useSocketStore((s) => ({
    appConfig: s.appConfig,
  }));

  const mcpServersCount = mcpServersData?.length || 0;
  const agentsCount = agents.length;

  const hasInitializedRef = useRef(false);
  const measuredNodeLayoutKey = getMeasuredNodeLayoutKey({
    agents,
    appConfig,
    mcpServersData,
    mcpxStatus,
    version,
  });

  // ------------------------------------------------------------------
  // Build graph
  // ------------------------------------------------------------------

  const buildGraph = useCallback(() => {
    if (!mcpServersData || !Array.isArray(mcpServersData)) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const existingNodes = getNodes();
    const measured = buildMeasuredMap(existingNodes);

    // ----- MCPX hub -----
    const mcpxH = measured.get("mcpx")?.height ?? MCP_NODE_HEIGHT;
    const mcpxNode: McpxNode = {
      id: "mcpx",
      position: { x: -70, y: -mcpxH / 2 },
      data: { status: mcpxStatus, version: version || "Unknown" },
      type: "mcpx",
      style: NODE_TRANSITION_STYLE,
    };

    // ----- Server nodes -----
    const sortedServers = sortServers(mcpServersData, appConfig);
    const serverNodes: McpServerNode[] = sortedServers.map((server) => {
      const serverAttributes = appConfig?.targetServerAttributes?.[server.name];
      const isInactive = serverAttributes?.inactive === true;
      const status = isInactive
        ? SERVER_STATUS.connected_inactive
        : server.status;

      return {
        id: server.id,
        position: { x: 0, y: 0 },
        data: { ...server, status, label: server.name },
        type: "mcpServer",
        style: NODE_TRANSITION_STYLE,
      };
    });

    const noServersNodes: NoServersNode[] =
      mcpServersCount === 0
        ? [
            {
              data: {},
              id: "no-servers",
              position: { x: 0, y: 0 },
              type: "noServers",
              style: NODE_TRANSITION_STYLE,
            },
          ]
        : [];

    // ----- Agent nodes -----
    const sortedAgents = [...agents].sort((a, b) =>
      a.identifier.localeCompare(b.identifier),
    );
    const agentNodes: AgentNode[] = sortedAgents.map((agent) => ({
      id: agent.id,
      position: { x: 0, y: 0 },
      data: { ...agent, label: agent.identifier },
      type: "agent",
      style: NODE_TRANSITION_STYLE,
    }));

    const noAgentsNodes: NoAgentsNode[] =
      agentsCount === 0
        ? [
            {
              data: {},
              id: "no-agents",
              position: { x: 0, y: 0 },
              type: "noAgents",
              style: NODE_TRANSITION_STYLE,
            },
          ]
        : [];

    // ----- Layout -----
    const mcpxMeasured = measured.get("mcpx");
    const mcpxW = mcpxMeasured?.width ?? NODE_WIDTH;
    const rightBaseX = COLUMN_GAP;
    const serverSideGap = rightBaseX - (mcpxNode.position.x + mcpxW);
    const leftBaseX = mcpxNode.position.x - serverSideGap;

    const rightIds =
      serverNodes.length > 0
        ? serverNodes.map((n) => n.id)
        : noServersNodes.map((n) => n.id);
    const leftIds =
      agentNodes.length > 0
        ? agentNodes.map((n) => n.id)
        : noAgentsNodes.map((n) => n.id);

    const rightLayout = stackColumn(rightIds, measured, rightBaseX, "right");
    const leftLayout = stackColumn(leftIds, measured, leftBaseX, "left");

    const allDataNodes = [
      ...serverNodes,
      ...noServersNodes,
      ...agentNodes,
      ...noAgentsNodes,
    ];
    for (const node of allDataNodes) {
      const info = rightLayout.get(node.id) ?? leftLayout.get(node.id);
      if (info) {
        node.position = { x: info.x, y: info.y };
      }
    }

    // ----- Edges -----

    const serverLayoutMap = rightLayout;
    const agentLayoutMap = leftLayout;

    // Compute the right edge X of each server column (position.x + width)
    // so edges to column N route past column N-1 without crossing nodes.
    const columnRightEdgeX: Record<number, number> = {};
    for (const [nodeId, info] of serverLayoutMap) {
      const w = measured.get(nodeId)?.width ?? NODE_WIDTH;
      const rightEdge = info.x + w;
      columnRightEdgeX[info.column] = Math.max(
        columnRightEdgeX[info.column] ?? 0,
        rightEdge,
      );
    }

    // Compute the left edge X of each agent column so edges from farther-left
    // columns can route past the previous column before bending toward MCPX.
    const columnLeftEdgeX: Record<number, number> = {};
    for (const [, info] of agentLayoutMap) {
      const leftEdge = info.x;
      columnLeftEdgeX[info.column] = Math.min(
        columnLeftEdgeX[info.column] ?? leftEdge,
        leftEdge,
      );
    }

    const btnSize = 32;
    const btnGap = 30;
    const mcpxX = mcpxNode.position.x;
    const addAgentJunctionX = mcpxX - btnGap - btnSize / 2;

    const selectedNodeIds = new Set<string>();

    const mcpServersEdges: Edge[] = sortedServers.map((server, index) => {
      const { id, status, name } = server;
      const serverAttributes = appConfig?.targetServerAttributes?.[name];
      const isInactive = serverAttributes?.inactive === true;
      const finalStatus = isInactive
        ? SERVER_STATUS.connected_inactive
        : status;
      const isRunning = finalStatus === SERVER_STATUS.connected_running;

      if (isRunning) {
        selectedNodeIds.add("mcpx");
        selectedNodeIds.add(id);
      }

      const layout = serverLayoutMap.get(id);

      return {
        animated: isRunning,
        className: "#DDDCE4",
        id: `e-mcpx-${id}`,
        source: "mcpx",
        style: {
          stroke:
            finalStatus === SERVER_STATUS.connected_inactive
              ? "#C3C4CD"
              : isRunning
                ? "var(--colors-route-active)"
                : "#D8DCED",
          strokeWidth: 1,
          strokeDasharray: isRunning ? "5,5" : undefined,
        },
        target: id,
        type: "curved",
        data: {
          addButtonKind: index === 0 ? "server" : undefined,
          animated: isRunning,
          column: layout?.column ?? 0,
          nodesInColumn: layout?.nodesInColumn ?? 1,
          prevColumnRightEdgeX:
            columnRightEdgeX[(layout?.column ?? 1) - 1] ?? 0,
        },
      };
    });

    const agentsEdges: Edge[] = agents.map(({ id, lastActivity }, index) => {
      const isActiveAgent = isActive(lastActivity);
      const layout = agentLayoutMap.get(id);

      if (isActiveAgent) {
        selectedNodeIds.add(id);
        selectedNodeIds.add("mcpx");
      }

      return {
        animated: isActiveAgent,
        className: "#DDDCE4",
        id: `e-${id}`,
        source: id,
        style: {
          stroke: isActiveAgent ? "var(--colors-route-active)" : "#D8DCED",
          strokeWidth: 1,
          strokeDasharray: isActiveAgent ? "5,5" : undefined,
        },
        target: "mcpx",
        type: "curved",
        data: {
          addButtonKind: index === 0 ? "agent" : undefined,
          animated: isActiveAgent,
          column: layout?.column ?? 0,
          nodesInColumn: layout?.nodesInColumn ?? 1,
          junctionX: addAgentJunctionX,
          prevColumnLeftEdgeX: columnLeftEdgeX[(layout?.column ?? 1) - 1] ?? 0,
        },
      };
    });

    const allNodes = [
      mcpxNode,
      ...serverNodes,
      ...noServersNodes,
      ...agentNodes,
      ...noAgentsNodes,
    ].map((node) =>
      selectedNodeIds.has(node.id) ? { ...node, selected: true } : node,
    );

    setNodes(allNodes);

    const allEdges = [...mcpServersEdges, ...agentsEdges];
    allEdges.sort((a, b) => {
      const aAnim = a.data?.animated ? 1 : 0;
      const bAnim = b.data?.animated ? 1 : 0;
      return aAnim - bAnim;
    });
    setEdges(allEdges);
  }, [
    agents,
    agentsCount,
    appConfig,
    getNodes,
    mcpServersCount,
    mcpServersData,
    mcpxStatus,
    setEdges,
    setNodes,
    version,
  ]);

  // Initial + debounced rebuilds
  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      buildGraph();
      return;
    }
    const timeoutId = setTimeout(buildGraph, REBUILD_DEBOUNCE_MS);
    return () => clearTimeout(timeoutId);
  }, [buildGraph]);

  // Re-layout after measurement
  const hasRelayoutRef = useRef(false);
  const relayoutKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!nodesInitialized) return;
    if (
      hasRelayoutRef.current &&
      relayoutKeyRef.current === measuredNodeLayoutKey
    )
      return;

    hasRelayoutRef.current = true;
    relayoutKeyRef.current = measuredNodeLayoutKey;
    buildGraph();
  }, [nodesInitialized, buildGraph, measuredNodeLayoutKey]);

  // ------------------------------------------------------------------
  // Translate extent
  // ------------------------------------------------------------------

  const maxCount = Math.max(mcpServersCount, agentsCount);
  const dynamicTranslateExtent: CoordinateExtent = [
    [-(maxCount * NODE_WIDTH * 3), -(NODE_HEIGHT * 5)],
    [maxCount * NODE_WIDTH * 3, NODE_HEIGHT * 5],
  ];

  return {
    edges,
    nodes,
    onEdgesChange,
    onNodesChange,
    translateExtent: maxCount > 9 ? undefined : dynamicTranslateExtent,
  };
};
