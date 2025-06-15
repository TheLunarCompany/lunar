import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Brain,
  CheckCircle2,
  Clock,
  Hexagon,
  ServerIcon,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import CurvedConnectionLine from "./CurvedConnectionLine";

const StatusIcon = ({ status, size = "w-2.5 h-2.5" }) => {
  const icons = {
    connected_running: (
      <CheckCircle2 className={`${size} text-[var(--color-fg-success)]`} />
    ),
    connected_stopped: (
      <CheckCircle2 className={`${size} text-[var(--color-fg-info)]`} />
    ),
    disconnected: (
      <XCircle className={`${size} text-[var(--color-text-disabled)]`} />
    ),
    connected: (
      <CheckCircle2 className={`${size} text-[var(--color-fg-success)]`} />
    ), // Added 'connected' status
    // Removed 'running' and 'stopped' specific to MCPX as per outline
    error: <XCircle className={`${size} text-[var(--color-fg-danger)]`} />,
  };
  return (
    icons[status] || (
      <Clock className={`${size} text-[var(--color-fg-warning)]`} />
    )
  );
};

const AgentNode = ({ agent, onClick, isSelected }) => (
  <div
    className="flex flex-col items-center gap-0.5 relative"
    id={`agent-${agent.id}`}
  >
    <Card
      className={`p-1 w-20 transition-all duration-300 hover:shadow-sm border cursor-pointer ${
        // Adjusted width
        agent.status === "connected"
          ? "border-[var(--color-border-success)] bg-[var(--color-bg-success)]"
          : "border-[var(--color-border-primary)] bg-[var(--color-bg-container)]"
      } ${isSelected ? "ring-1 ring-offset-0.5 ring-[var(--color-fg-interactive)]" : ""}`}
      onClick={() => onClick(agent)}
    >
      <div className="flex items-center justify-between mb-0.5">
        <Brain
          className={`w-2.5 h-2.5 ${agent.status === "connected" ? "text-[var(--color-fg-interactive)]" : "text-[var(--color-text-disabled)]"}`}
        />{" "}
        {/* Adjusted icon size */}
        <StatusIcon
          status={
            agent.status === "connected" ? "connected_running" : "disconnected"
          }
        />
      </div>
      <h3 className="font-medium text-[var(--color-text-primary)] text-[9px] mb-0">
        AI Agent
      </h3>{" "}
      {/* Adjusted font size */}
      <p className="text-[7px] text-[var(--color-text-secondary)] font-mono truncate w-full">
        {agent.identifier}
      </p>{" "}
      {/* Adjusted font size */}
    </Card>
  </div>
);

const MCPXNode = ({ mcpxStatus, onClick, onOpenMCPXConfigModal }) => (
  <div
    className="flex flex-col items-center relative"
    id="mcpx-node"
    onClick={onClick}
  >
    <Card
      className={`w-24 transition-all duration-300 hover:shadow-lg border flex flex-col cursor-pointer ${
        // Adjusted width
        mcpxStatus === "running"
          ? "border-[var(--color-border-success)] bg-[var(--color-bg-success)] shadow-[var(--color-bg-success-hover)]"
          : "border-[var(--color-border-primary)] bg-[var(--color-bg-container)]"
      }`}
    >
      <div className="p-1.5 flex-grow">
        <div className="flex items-center justify-between mb-0.5">
          <div
            className={`w-5 h-5 rounded-md flex items-center justify-center ${
              // Adjusted size
              mcpxStatus === "running"
                ? "bg-[var(--color-text-primary)]"
                : "bg-[var(--color-text-disabled)]"
            }`}
          >
            <Hexagon className="w-3 h-3 text-[var(--color-text-primary-inverted)]" />{" "}
            {/* Adjusted icon size */}
          </div>
          <StatusIcon status={mcpxStatus} />
        </div>
        <h3 className="font-bold text-[var(--color-text-primary)] text-[10px] mb-0">
          MCPX
        </h3>{" "}
        {/* Adjusted font size */}
        <p className="text-[8px] text-[var(--color-text-secondary)]">
          Aggregator
        </p>{" "}
        {/* Adjusted font size */}
        <Badge
          variant="outline"
          className={`mt-0.5 text-[7px] px-1 py-0 ${
            // Adjusted font size
            mcpxStatus === "running"
              ? "border-[var(--color-border-success)] text-[var(--color-fg-success)] bg-[var(--color-bg-success)]"
              : "border-[var(--color-border-primary)] text-[var(--color-text-secondary)] bg-[var(--color-bg-container)]"
          }`}
        >
          {mcpxStatus === "running" ? "Active" : "Inactive"}
        </Badge>
      </div>
    </Card>
  </div>
);

const MCPServerNode = ({ server, onClick, isActive }) => {
  const getServerIconDisplay = (iconType) => {
    // Using simple text/emoji icons as per outline
    const textIcons = {
      slack: "💬",
      "google-maps": "🗺️",
      github: "💻",
      gmail: "📧",
      default: "⚙️",
    };
    return textIcons[iconType] || textIcons.default;
  };

  const isRunning = server.status === "connected_running";
  const isConnected =
    server.status === "connected_running" ||
    server.status === "connected_stopped";

  return (
    <div
      className="flex flex-col items-center gap-0.5 relative"
      id={`server-${server.id}`}
    >
      <Card
        className={`p-1 w-24 cursor-pointer transition-all duration-300 hover:shadow-sm border ${
          // Adjusted width
          isRunning
            ? "border-[var(--color-border-success)] bg-[var(--color-bg-success)]"
            : isConnected
              ? "border-[var(--color-border-info)] bg-[var(--color-bg-info)]"
              : "border-[var(--color-border-primary)] bg-[var(--color-bg-container)]"
        } ${isActive ? "ring-1 ring-offset-0.5 ring-[var(--color-fg-interactive)]" : ""}`}
        onClick={() => onClick(server)}
      >
        <div className="flex items-center justify-between mb-0.5">
          <div className="text-xs">{getServerIconDisplay(server.icon)}</div>{" "}
          {/* Adjusted icon size */}
          <StatusIcon status={server.status} />
        </div>
        <h3 className="font-medium text-[var(--color-text-primary)] mb-0 text-[9px] truncate">
          {server.name}
        </h3>{" "}
        {/* Adjusted font size */}
        <p className="text-[7px] text-[var(--color-text-secondary)] mb-0.5">
          {" "}
          {/* Adjusted font size */}
          {server.tools?.length || 0} Tools
        </p>
        {/* Removed Start/Stop Button */}
      </Card>
    </div>
  );
};

// Removed custom SlackIcon, MapPinIcon, GithubIcon components as they are no longer used.

export default function ConnectivityDiagram({
  agents,
  mcpxStatus,
  mcpServersData,
  onMCPServerClick,
  selectedServer,
  onMCPXClick,
  onOpenMCPXConfigModal, // onToggleMCPX removed
  onAgentClick,
  selectedAgent,
}) {
  const diagramRef = useRef(null);
  const [nodePositions, setNodePositions] = useState({});

  useEffect(() => {
    const calculatePositions = () => {
      if (!diagramRef.current) return;
      const newPositions = {};
      const mcpxNode = diagramRef.current.querySelector("#mcpx-node");
      if (mcpxNode) {
        const rect = mcpxNode.getBoundingClientRect();
        const diagramRect = diagramRef.current.getBoundingClientRect();
        newPositions["mcpx-node"] = {
          x: rect.left - diagramRect.left + rect.width / 2,
          y: rect.top - diagramRect.top + rect.height / 2,
          width: rect.width,
          height: rect.height,
        };
      }
      agents.forEach((agent) => {
        const node = diagramRef.current.querySelector(`#agent-${agent.id}`);
        if (node) {
          const rect = node.getBoundingClientRect();
          const diagramRect = diagramRef.current.getBoundingClientRect();
          newPositions[`agent-${agent.id}`] = {
            x: rect.left - diagramRect.left + rect.width / 2,
            y: rect.top - diagramRect.top + rect.height / 2,
            width: rect.width,
            height: rect.height,
          };
        }
      });
      mcpServersData.forEach((server) => {
        const node = diagramRef.current.querySelector(`#server-${server.id}`);
        if (node) {
          const rect = node.getBoundingClientRect();
          const diagramRect = diagramRef.current.getBoundingClientRect();
          newPositions[`server-${server.id}`] = {
            x: rect.left - diagramRect.left + rect.width / 2,
            y: rect.top - diagramRect.top + rect.height / 2,
            width: rect.width,
            height: rect.height,
          };
        }
      });
      setNodePositions(newPositions);
    };

    const handleResize = () => calculatePositions();
    calculatePositions();
    window.addEventListener("resize", handleResize);
    const resizeObserver = new ResizeObserver(handleResize);
    if (diagramRef.current) {
      resizeObserver.observe(diagramRef.current);
      Array.from(diagramRef.current.querySelectorAll(".relative")).forEach(
        (el) => resizeObserver.observe(el),
      );
    }
    const timeoutId = setTimeout(calculatePositions, 50);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (diagramRef.current) {
        resizeObserver.disconnect();
      }
      clearTimeout(timeoutId);
    };
  }, [agents, mcpServersData, mcpxStatus]);

  const mcpxPos = nodePositions["mcpx-node"];

  return (
    <div
      className="relative w-full h-full flex items-center justify-center p-1"
      ref={diagramRef}
    >
      {/* Connection Lines */}
      {mcpxPos &&
        agents.map((agent) => {
          const agentPos = nodePositions[`agent-${agent.id}`];
          if (!agentPos) return null;
          const agentActive = agent.status === "connected";
          return (
            <CurvedConnectionLine
              key={`line-agent-${agent.id}`}
              lineId={`line-agent-${agent.id}`}
              startX={agentPos.x + agentPos.width / 2}
              startY={agentPos.y}
              endX={mcpxPos.x - mcpxPos.width / 2}
              endY={mcpxPos.y}
              active={agentActive && mcpxStatus === "running"}
            />
          );
        })}
      {mcpxPos &&
        mcpServersData.map((server) => {
          const serverPos = nodePositions[`server-${server.id}`];
          if (!serverPos) return null;
          const serverLineActive = server.status === "connected_running";
          return (
            <CurvedConnectionLine
              key={`line-server-${server.id}`}
              lineId={`line-server-${server.id}`}
              startX={mcpxPos.x + mcpxPos.width / 2}
              startY={mcpxPos.y}
              endX={serverPos.x - serverPos.width / 2}
              endY={serverPos.y}
              active={serverLineActive && mcpxStatus === "running"}
            />
          );
        })}

      {/* Node Layout */}
      <div className="flex items-start justify-around w-full max-w-4xl">
        {" "}
        {/* Adjusted max-width */}
        {/* AI Agents Column */}
        <div className="flex flex-col gap-1 items-center py-1">
          {agents.length > 0 ? (
            agents.map((agent) => (
              <AgentNode
                key={agent.id}
                agent={agent}
                onClick={onAgentClick}
                isSelected={selectedAgent?.id === agent.id}
              />
            ))
          ) : (
            <Card className="p-1 w-20 border-dashed border-[var(--color-border-primary)] bg-[var(--color-bg-container)]">
              {" "}
              {/* Adjusted width */}
              <div className="flex flex-col items-center gap-0.5 text-[var(--color-text-disabled)]">
                <Brain className="w-2.5 h-2.5" /> {/* Adjusted icon size */}
                <p className="text-[7px] font-medium">No agents</p>{" "}
                {/* Adjusted font size */}
              </div>
            </Card>
          )}
        </div>
        {/* MCPX Central Node */}
        <div className="flex flex-col items-center mx-1 py-1 self-center">
          <MCPXNode
            mcpxStatus={mcpxStatus}
            onClick={onMCPXClick}
            onOpenMCPXConfigModal={onOpenMCPXConfigModal}
            // onToggleMCPX removed
          />
        </div>
        {/* MCP Servers Column */}
        <div className="flex flex-col gap-1 items-center py-1">
          {mcpServersData.length > 0 ? (
            mcpServersData.map((server) => (
              <MCPServerNode
                key={server.id}
                server={server}
                onClick={onMCPServerClick}
                isActive={selectedServer?.id === server.id}
                // onToggleMCPServerStatus removed
              />
            ))
          ) : (
            <Card className="p-1 w-24 border-dashed border-[var(--color-border-primary)] bg-[var(--color-bg-container)]">
              {" "}
              {/* Adjusted width */}
              <div className="flex flex-col items-center gap-0.5 text-[var(--color-text-disabled)]">
                <ServerIcon className="w-2.5 h-2.5" />{" "}
                {/* Adjusted icon size */}
                <p className="text-[7px] font-medium">No MCP servers</p>{" "}
                {/* Adjusted font size */}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
