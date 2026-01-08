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
import { useSocketStore } from "@/store";
import {
  AgentNode,
  McpServerNode,
  McpxNode,
  NoAgentsNode,
  NoServersNode,
} from "../types";
import {
  AGENT_NODE_GAP,
  AGENT_NODE_WIDTH,
  getServerGridYOffsets,
  MCP_NODE_HEIGHT,
  NODE_HEIGHT,
  NODE_WIDTH,
  SERVER_NODE_INITIAL_GAP,
  ZERO_STATE_GAP,
  ZERO_STATE_NODE_HEIGHT,
  ZERO_STATE_PADDING,
} from "./constants";
import { SERVER_STATUS } from "@/types/mcp-server";

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

  const { appConfig } = useSocketStore((s) => ({
    appConfig: s.appConfig,
  }));

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
        x: -20,
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
        .sort((a, b) => {
          // Check if servers are inactive from appConfig
          const isAInactive =
            appConfig?.targetServerAttributes?.[a.name]?.inactive === true;
          const isBInactive =
            appConfig?.targetServerAttributes?.[b.name]?.inactive === true;

          // Inactive servers go to the end
          if (isAInactive && !isBInactive) return 1;
          if (!isAInactive && isBInactive) return -1;

          // If both are inactive or both are active, sort by status priority
          const getStatusPriority = (status: string): number => {
            if (
              status === SERVER_STATUS.connected_running ||
              status === SERVER_STATUS.connected_stopped ||
              status === SERVER_STATUS.connected_inactive
            )
              return 0; // Connected (highest priority)
            if (status === SERVER_STATUS.pending_auth) return 1; // Pending-Auth (middle priority)
            if (status === SERVER_STATUS.connection_failed) return 2; // Error (lowest priority)
            return 3; // Unknown status (lowest priority)
          };

          const priorityA = getStatusPriority(a.status);
          const priorityB = getStatusPriority(b.status);

          // If priorities are different, sort by priority
          if (priorityA !== priorityB) {
            return priorityA - priorityB;
          }

          // If priorities are the same, sort alphabetically by name
          return a.name.localeCompare(b.name);
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
            x:
              -90 +
              SERVER_NODE_INITIAL_GAP +
              NODE_WIDTH / 2 +
              column * (NODE_WIDTH + ZERO_STATE_PADDING) +
              ZERO_STATE_PADDING +
              columnOffset,
            y: mcpxCenterY + yOffset,
          };

          // Check if server is inactive from appConfig
          const serverAttributes =
            appConfig?.targetServerAttributes?.[server.name];
          const isInactive = serverAttributes?.inactive === true;

          // Update status to connected_inactive if inactive
          const status = isInactive
            ? SERVER_STATUS.connected_inactive
            : server.status;

          return {
            id: server.id,
            position,
            data: {
              ...server,
              status,
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

          // Dynamic Y positions based on node count in column
          // Pattern: Index 0 aligned with MCPX, then alternating up/down
          const mcpxCenterY = ZERO_STATE_NODE_HEIGHT / 2 - MCP_NODE_HEIGHT / 2;
          const yOffsets = getServerGridYOffsets(nodesInThisColumn);
          const yOffset = yOffsets[indexInColumn] || 0; // Use dynamic offset or 0 if out of range

          const position = {
            x:
              -1 *
              (AGENT_NODE_GAP +
                AGENT_NODE_WIDTH +
                column * (AGENT_NODE_WIDTH + ZERO_STATE_PADDING) +
                ZERO_STATE_PADDING),
            y: mcpxCenterY + yOffset + 7,
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
                x:
                  -1 *
                  (AGENT_NODE_GAP + AGENT_NODE_WIDTH + 80 + ZERO_STATE_PADDING),
                y: 0,
              },
              type: "noAgents",
            },
          ]
        : [];

    // Create MCP edges - use same sorted order as nodes (must match node sorting logic)
    const sortedServersForEdges = [...mcpServersData].sort((a, b) => {
      // Check if servers are inactive from appConfig (must match node sorting)
      const isAInactive =
        appConfig?.targetServerAttributes?.[a.name]?.inactive === true;
      const isBInactive =
        appConfig?.targetServerAttributes?.[b.name]?.inactive === true;

      // Inactive servers go to the end (must match node sorting)
      if (isAInactive && !isBInactive) return 1;
      if (!isAInactive && isBInactive) return -1;

      // If both are inactive or both are active, sort by status priority
      const getStatusPriority = (status: string): number => {
        if (
          status === SERVER_STATUS.connected_running ||
          status === SERVER_STATUS.connected_stopped ||
          status === SERVER_STATUS.connected_inactive
        )
          return 0; // Connected (highest priority)
        if (status === SERVER_STATUS.pending_auth) return 1; // Pending-Auth (middle priority)
        if (status === SERVER_STATUS.connection_failed) return 2; // Error (lowest priority)
        return 3; // Unknown status (lowest priority)
      };

      const priorityA = getStatusPriority(a.status);
      const priorityB = getStatusPriority(b.status);

      // If priorities are different, sort by priority
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // If priorities are the same, sort alphabetically by name
      return a.name.localeCompare(b.name);
    });

    const mcpServersEdges: Edge[] = sortedServersForEdges.map(
      (server, index) => {
        const { id, status, name } = server;
        // Check if server is inactive from appConfig
        const serverAttributes = appConfig?.targetServerAttributes?.[name];
        const isInactive = serverAttributes?.inactive === true;
        const finalStatus = isInactive
          ? SERVER_STATUS.connected_inactive
          : status;
        const isRunning = finalStatus === SERVER_STATUS.connected_running;
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
            stroke:
              finalStatus === SERVER_STATUS.connected_inactive
                ? "#C3C4CD"
                : isRunning
                  ? "#B4108B"
                  : "#D8DCED",
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
      },
    );
    // Create Agent edges
    const agentsEdges: Edge[] = agents.map(({ id, lastActivity }) => {
      const isActiveAgent = isActive(lastActivity);

      return {
        animated: isActiveAgent,
        className: "#DDDCE4",
        id: `e-${id}`,
        source: id,
        style: {
          stroke: isActiveAgent ? "#B4108B" : "#D8DCED",
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
  }, [agents, mcpServersData, mcpxStatus, appConfig, setEdges, setNodes]);

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
