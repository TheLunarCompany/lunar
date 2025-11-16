import { Agent, McpServer } from "@/types";
import { isActive } from "@/utils";

import {
  Edge,
  Node,
  OnEdgesChange,
  OnNodesChange,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";

import { CoordinateExtent } from "@xyflow/system";
import { useEffect } from "react";

import {
  AgentNode,
  McpServerNode,
  McpxNode,
  NoAgentsNode,
  NoServersNode,
} from "../types";

import { NODE_HEIGHT, NODE_WIDTH } from "./constants";

const MAX_SERVERS_PER_COLUMN = 6;
const COLUMN_SPACING = 160; // Space between columns
const ROW_SPACING = 80; // Space between rows
const MCPX_X = 240; // MCPX position
const SERVERS_START_X = MCPX_X + COLUMN_SPACING; // Where server columns start

// ------------------------------
// HOOK
// ------------------------------

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

  const serverCount = mcpServersData?.length || 0;
  const agentCount = agents.length;

  useEffect(() => {
    if (!mcpServersData) {
      setNodes([]);
      setEdges([]);
      return;
    }

    // --------------------------
    // BUILD BASE RAW NODES
    // --------------------------

    // Calculate center Y position for MCPX based on number of servers
    const totalServerRows = Math.min(MAX_SERVERS_PER_COLUMN, serverCount);
    const centerY = (totalServerRows * ROW_SPACING) / 2;

    const mcpxNode: McpxNode = {
      id: "mcpx",
      position: { x: MCPX_X, y: centerY },
      data: { status: mcpxStatus, version: version || "Unknown" },
      type: "mcpx",
    };

    const serverNodes: Node[] =
      mcpServersData.length > 0
        ? mcpServersData
            .sort((a, b) => a.name.localeCompare(b.name))
            .sort((a, b) => {
              const statusPriority = (status: string) => {
                if (status === "connected_running" || status === "connected_stopped") return 0;
                if (status === "connection_failed" || status === "pending_auth") return 2;
                return 1;
              };
              const pA = statusPriority(a.status);
              const pB = statusPriority(b.status);
              if (pA !== pB) return pA - pB;
              return 0;
            })
            .map((server, index) => {
              // Calculate column and row for this server
              const column = Math.floor(index / MAX_SERVERS_PER_COLUMN);
              const row = index % MAX_SERVERS_PER_COLUMN;
              
              // Position: columns go right, rows go down
              const x = SERVERS_START_X + (column * COLUMN_SPACING);
              const y = row * ROW_SPACING;

              return {
                id: server.id,
                position: { x, y },
                data: { ...server, label: server.name },
                type: "mcpServer",
              };
            })
        : [];

    const noServersNode: Node[] =
      serverCount === 0
        ? [
            {
              id: "no-servers",
              position: { x: SERVERS_START_X, y: centerY },
              data: {},
              type: "noServers",
            },
          ]
        : [];

    // Calculate agent positions on the left side of MCPX
    const AGENTS_X = 80; // Agents closer to MCPX
    const agentStartY = centerY - ((agentCount - 1) * ROW_SPACING) / 2;

    const agentNodes: Node[] =
      agents.length > 0
        ? agents.map((agent, index) => ({
            id: agent.id,
            position: { x: AGENTS_X, y: agentStartY + index * ROW_SPACING },
            data: { ...agent, label: agent.identifier },
            type: "agent",
          }))
        : [];

    const noAgentsNode: Node[] =
      agentCount === 0
        ? [
            {
              id: "no-agents",
              position: { x: 0, y: 240},
              data: {},
              type: "noAgents",
            },
          ]
        : [];

    // Create single invisible waypoint node where line diverges to all servers
    const waypointNodes: Node[] = [];
    
    if (serverCount > 0) {
      const waypointX = MCPX_X + (SERVERS_START_X - MCPX_X) / 2;
      waypointNodes.push({
        id: "waypoint-diverge",
        position: { x: waypointX, y: centerY },
        data: {},
        type: "default",
        style: { opacity: 0, width: 1, height: 1 },
      });
    }

    const allNodes: Node[] = [
      mcpxNode,
      ...serverNodes,
      ...noServersNode,
      ...agentNodes,
      ...noAgentsNode,
      ...waypointNodes,
    ];

    // --------------------------
    // BUILD EDGES
    // --------------------------

    const serverEdges: Edge[] = mcpServersData.map(({ id, status }) => {
      const running = status === "connected_running";

      return {
        id: `e-mcpx-${id}`,
        source: "mcpx",
        target: id,
        animated: running,
        style: {
          stroke: running ? "#B4108B" : "#DDDCE4",
          strokeWidth: 1,
          strokeDasharray: running ? "5,5" : undefined,
        },
      };
    });

    const agentEdges: Edge[] = agents.map(({ id, lastActivity }) => {
      const active = isActive(lastActivity);
      return {
        id: `e-${id}`,
        source: id,
        target: "mcpx",
        animated: active,
        style: {
          stroke: active ? "#B4108B" : "#DDDCE4",
          strokeWidth: 1,
          strokeDasharray: active ? "5,5" : undefined,
        },
      };
    });

    const allEdges = [...serverEdges, ...agentEdges];

    // Set nodes and edges with manual positioning
    setNodes(allNodes);
    setEdges(allEdges);
  }, [agents, mcpServersData, mcpxStatus, version, setEdges, setNodes]);

  const maxCount = Math.max(serverCount, agentCount);
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
