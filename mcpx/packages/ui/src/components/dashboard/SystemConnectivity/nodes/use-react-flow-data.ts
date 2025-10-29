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

const MAX_NODES_PER_COLUMN = 4;

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
        y: -0.5,
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

          const position = {
            x: NODE_WIDTH * 1.5 + column * (NODE_WIDTH + 40),
            y:
              (indexInColumn - (nodesInThisColumn - 1) / 2) *
              (NODE_HEIGHT * 1.2),
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
              x: NODE_WIDTH,
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

          const position = {
            x: -NODE_WIDTH * 1.1 - column * (NODE_WIDTH + 40),
            y:
              (indexInColumn - (nodesInThisColumn - 1) / 2) *
              (NODE_HEIGHT * 1.2),
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
              x: -NODE_WIDTH * 1.8,
              y: 0,
            },
            type: "noAgents",
          },
        ]
        : [];

    // Create MCP edges
    const mcpServersEdges: Edge[] = mcpServersData.map(({ id, status }) => {
      const isRunning = status === "connected_running";

      return {
        animated: isRunning,
        className:
          "#DDDCE4",
        id: `e-mcpx-${id}`,
        source: "mcpx",
        style: {
          stroke: isRunning ? "#B4108B" : "#DDDCE4",
          strokeWidth: 1,
          strokeDasharray: isRunning ? "5,5" : undefined,
        },
        target: id,
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
    setEdges([...mcpServersEdges, ...agentsEdges]);
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
