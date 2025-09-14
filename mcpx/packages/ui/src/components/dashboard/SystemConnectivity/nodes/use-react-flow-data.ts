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

    // Create MCP servers nodes or NoServers node
    const serverNodes: McpServerNode[] = mcpServersData.map((server, index) => {
      const position = {
        x:
          mcpServersCount < 5
            ? NODE_WIDTH
            : NODE_WIDTH * 2 +
              10 * (mcpServersCount - Math.abs(index - mcpServersCount / 2)),
        y:
          mcpServersCount === 1 ||
          (mcpServersCount > 3 &&
            mcpServersCount % 2 === 0 &&
            index > mcpServersCount / 2 &&
            index - 1 < mcpServersCount / 2)
            ? 16
            : NODE_HEIGHT / 2 +
              16 +
              Math.abs(index - mcpServersCount / 2) *
                (index > mcpServersCount / 2 ? NODE_HEIGHT : -NODE_HEIGHT),
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

    // Create NoServers node if no servers are present
    const noServersNodes: NoServersNode[] =
      mcpServersCount === 0
        ? [
            {
              data: {},
              id: "no-servers",
              position: {
                x: NODE_WIDTH,
                y: 16,
              },
              type: "noServers",
            },
          ]
        : [];

    // Create Agent nodes
    const agentNodes: AgentNode[] = agents.map((agent, index) => ({
      id: agent.id,
      position: {
        x:
          agentsCount < 5
            ? -NODE_WIDTH
            : -(
                NODE_WIDTH * 2 +
                10 * (agentsCount - Math.abs(index - agentsCount / 2))
              ),
        y:
          agentsCount === 1 ||
          (agentsCount > 3 &&
            agentsCount % 2 === 0 &&
            index > agentsCount / 2 &&
            index - 1 < agentsCount / 2)
            ? 20
            : NODE_HEIGHT / 2 +
              10 +
              Math.abs(index - agentsCount / 2) *
                (index > agentsCount / 2 ? NODE_HEIGHT : -NODE_HEIGHT),
      },
      data: {
        ...agent,
        label: agent.identifier,
      },
      type: "agent",
    }));

    // Create `NoAgents` node if no agents are present
    const noAgentsNodes: NoAgentsNode[] =
      agentsCount === 0
        ? [
            {
              data: {},
              id: "no-agents",
              position: {
                x: -NODE_WIDTH * 1.6,
                y: 17,
              },
              type: "noAgents",
            },
          ]
        : [];

    // Create MCP edges
    const mcpServersEdges: Edge[] = mcpServersData.map(({ id, status }) => {
      const isRunning = status === "connected_running";
      const isPendingAuth = status === "pending_auth";
      const isFailed = status === "connection_failed";

      return {
        animated: isRunning,
        className: isRunning
          ? "text-green-500"
          : isFailed
            ? "text-red-500"
            : isPendingAuth
              ? "text-yellow-500"
              : "text-gray-400",
        id: `e-mcpx-${id}`,
        source: "mcpx",
        style: {
          stroke: "currentColor",
          strokeWidth: isRunning ? 2 : 1,
          strokeDasharray: isRunning ? "5,5" : undefined,
        },
        target: id,
      };
    });
    // Create Agent edges
    const agentsEdges: Edge[] = agents.map(({ id, lastActivity, status }) => {
      const isActiveAgent = isActive(lastActivity);
      const isConnected = status === "connected";
      return {
        animated: isActiveAgent,
        className:
          isActiveAgent && isConnected ? "text-green-500" : "text-gray-400",
        id: `e-${id}`,
        source: id,
        style: {
          stroke: "currentColor",
          strokeWidth: isActiveAgent ? 2 : 1,
          strokeDasharray: isActiveAgent ? "5,5" : undefined,
        },
        target: "mcpx",
      };
    });

    setNodes([
      mcpxNode,
      ...serverNodes,
      ...noServersNodes,
      ...agentNodes,
      ...noAgentsNodes,
    ]);
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
