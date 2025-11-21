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
import { NODE_HEIGHT, NODE_WIDTH, ZERO_STATE_GAP, ZERO_STATE_BLOCK_WIDTH, ZERO_STATE_PADDING, ZERO_STATE_NODE_HEIGHT, MCP_NODE_HEIGHT, SERVER_NODE_HEIGHT, SERVER_NODE_INITIAL_GAP, SERVER_NODE_VERTICAL_SPACING, getServerGridYOffsets } from "./constants";

const MAX_NODES_PER_COLUMN = 6;

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

  const mcpServersCount = mcpServersData?.length || 0;
  const agentsCount = agents.length;
  

  useEffect(() => {
    if (!mcpServersData || !Array.isArray(mcpServersData)) {
      setNodes([]);
      setEdges([]);
      return;
    }

    // Create MCPX node
    const mcpxNode: McpxNode = {
      id: "mcpx",
      position: {
        x: 0,
        y: ZERO_STATE_NODE_HEIGHT / 2 - MCP_NODE_HEIGHT / 2,
      },
      data: {
        status: mcpxStatus,
        version: version || "Unknown",
      },
      type: "mcpx",
    };

    let serverNodes: McpServerNode[] = [];
    if (mcpServersData.length > 0) {

      serverNodes = mcpServersData
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
          const column = Math.floor(index / MAX_NODES_PER_COLUMN);
          const indexInColumn = index % MAX_NODES_PER_COLUMN;

          const nodesInThisColumn = Math.min(
            mcpServersData.length - column * MAX_NODES_PER_COLUMN,
            MAX_NODES_PER_COLUMN,
          );

          // Dynamic Y positions based on node count in column
          // Pattern: Index 0 aligned with MCPX, then alternating up/down
          const mcpxCenterY = ZERO_STATE_NODE_HEIGHT / 2 - MCP_NODE_HEIGHT / 2;
          const yOffsets = getServerGridYOffsets(nodesInThisColumn);
          const yOffset = yOffsets[indexInColumn] || 0; // Use dynamic offset or 0 if out of range
          
          // First column (column 0) is 50px left, other columns are 50px right
          const columnOffset = column === 0 ? 0 : 50 * column;
          const position = {
            x:  -110 + SERVER_NODE_INITIAL_GAP + NODE_WIDTH/2 + column * (NODE_WIDTH + ZERO_STATE_PADDING) + ZERO_STATE_PADDING + columnOffset,
            y: mcpxCenterY + yOffset,
          };

          return {
            id: server.id,
            position,
            data: {
              ...server,
              label: server.name,
            },
            type: "mcpServer",
          };
        });

      setNodes(serverNodes);
    }

    // Create NoServers node if no servers are present
    const noServersNodes: NoServersNode[] =
      mcpServersCount === 0
        ? [
          {
            data: {},
            id: "no-servers",
            position: {
              x: ZERO_STATE_GAP + NODE_WIDTH / 2 + ZERO_STATE_PADDING,
              y: 0,
            },
            type: "noServers",
          },
        ]
        : [];

    let agentNodes: AgentNode[] = [];
    // Create Agent nodes
    if (agents.length > 0) {
      agentNodes = agents
        .sort((a, b) => a.identifier.localeCompare(b.identifier))
        .map((agent, index) => {
          const column = Math.floor(index / MAX_NODES_PER_COLUMN);
          const indexInColumn = index % MAX_NODES_PER_COLUMN;
          const nodesInThisColumn = Math.min(
            agents.length - column * MAX_NODES_PER_COLUMN,
            MAX_NODES_PER_COLUMN,
          );

          // Dynamic Y positions based on node count in column (same as servers)
          const mcpxCenterY = ZERO_STATE_NODE_HEIGHT / 2 - MCP_NODE_HEIGHT / 2;
          const yOffsets = getServerGridYOffsets(nodesInThisColumn);
          const yOffset = yOffsets[indexInColumn] || 0; // Use dynamic offset or 0 if out of range
          
          const position = {
           x: -1 *(SERVER_NODE_INITIAL_GAP + NODE_WIDTH/2 + column * (NODE_WIDTH + ZERO_STATE_PADDING) + ZERO_STATE_PADDING),
          //  x:  -SERVER_NODE_INITIAL_GAP- column * (NODE_WIDTH + 16),
            y: mcpxCenterY + yOffset,
          };

          return {
            id: agent.id,
            position,
            data: {
              ...agent,
              label: agent.identifier,
            },
            type: "agent",
          };
        });

      setNodes(agentNodes);
    }

    const noAgentsNodes: NoAgentsNode[] =
      agentsCount === 0
        ? [
          {
            data: {},
            id: "no-agents",
            position: {
              x: -(ZERO_STATE_GAP + NODE_WIDTH / 2 + ZERO_STATE_BLOCK_WIDTH / 2 - ZERO_STATE_PADDING),
              y: 0,
            },
            type: "noAgents",
          },
        ]
        : [];

    // Create MCP edges - use same sorted order as nodes
    const sortedServersForEdges = mcpServersData
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
      });

    const mcpServersEdges: Edge[] = sortedServersForEdges.map((server, index) => {
      const { id, status } = server;
      const isRunning = status === "connected_running";
      const indexInColumn = index % MAX_NODES_PER_COLUMN;
      const column = Math.floor(index / MAX_NODES_PER_COLUMN);
      const nodesInThisColumn = Math.min(
        mcpServersData.length - column * MAX_NODES_PER_COLUMN,
        MAX_NODES_PER_COLUMN,
      );

      return {
        animated: isRunning,
        className: "#DDDCE4",
        id: `e-mcpx-${id}`,
        source: "mcpx",
        style: {
          stroke: isRunning ? "#B4108B" : "#DDDCE4",
          strokeWidth: 1,
          strokeDasharray: isRunning ? "5,5" : undefined,
        },
        target: id,
        type: "curved",
        data: { 
          animated: isRunning,
          indexInColumn, // Pass column index to edge for connection point logic
          column, // Pass column number for connection point calculation
          nodesInColumn: nodesInThisColumn, // Pass node count for wire connection logic
        },
      };
    });
    // Create Agent edges
    const agentsEdges: Edge[] = agents.map(({ id, lastActivity }) => {
      const isActiveAgent = isActive(lastActivity);

      return {
        animated: isActiveAgent,
        className: "#DDDCE4",
        id: `e-${id}`,
        source: id,
        style: {
          stroke: isActiveAgent ? "#B4108B" : "#DDDCE4",
          strokeWidth: 1,
          strokeDasharray: isActiveAgent ? "5,5" : undefined,
        },
        target: "mcpx",
        type: "curved",
        data: { animated: isActiveAgent },
      };
    });

    const allNodes = [
      mcpxNode,
      ...serverNodes,
      ...noServersNodes,
      ...agentNodes,
      ...noAgentsNodes,
    ];
    setNodes(allNodes);
    
    // Sort edges so animated ones render last (on top) - SVG uses DOM order for stacking
    const allEdges = [...mcpServersEdges, ...agentsEdges];
    const sortedEdges = allEdges.sort((a, b) => {
      const aAnimated = a.data?.animated ? 1 : 0;
      const bAnimated = b.data?.animated ? 1 : 0;
      return aAnimated - bAnimated; // Non-animated first (0), animated last (1)
    });
    setEdges(sortedEdges);
  }, [agents, mcpServersData, mcpxStatus, setEdges, setNodes]);

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
    translateExtent:
      // The dynamic translate extent work well for up to 9 nodes,
      // but for more than that the most extreme nodes get clipped and become unreachable.
      // This is a limitation of the current implementation, so we set it to undefined for infinite scrolling.
      // TODO: Fix the dynamic translate extent to handle more than 9 nodes,
      //  or implement a better way to position large numbers of nodes
      //  (e.g. some internal grid system).
      maxCount > 9 ? undefined : dynamicTranslateExtent,
  };
};
