import React from 'react';
import { EdgeProps, getSmoothStepPath } from '@xyflow/react';
import { SERVER_NODE_INITIAL_GAP, ZERO_STATE_PADDING } from './constants';

const CustomCurvedEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
}) => {
  // Determine connection type and adjust target position accordingly
  const NODE_WIDTH = 200; // Approximate node width (matches constants.ts)
  
  // Check if this is agent → MCPX (end at center) or MCPX → server (end at right side)
  // Agent edges: "e-{agentId}" (agent → MCPX, end at center)
  // MCPX edges: "e-mcpx-{serverId}" (MCPX → server, end at right side for 1 node, center for 2+ nodes)
  const isAgentToMcpx = id ? (id.startsWith("e-") && !id.startsWith("e-mcpx-")) : false;
  
  // Connection point for each column: positioned before the column, Y-aligned with MCPX center
  const column = typeof data?.column === 'number' ? data.column : undefined;
  const CONNECTION_POINT_TO_NODE_DISTANCE = 50; // 50px distance from connection point to nodes
  const COLUMN_CONNECTION_PADDING = 50; // Padding after each column before next column's connection point
  
  // Calculate connection point position: before each column, Y-aligned with MCPX
  // Add padding after each column: column 0 at base, column 1 adds NODE_WIDTH + ZERO_STATE_PADDING + COLUMN_CONNECTION_PADDING, etc.
  const connectionPointX = column !== undefined && column >= 0
    ? SERVER_NODE_INITIAL_GAP - 110 + column * (NODE_WIDTH + ZERO_STATE_PADDING + COLUMN_CONNECTION_PADDING)
    : sourceX;
  const connectionPointY = sourceY; // Y-aligned with MCPX center
  
  // For AI agent → MCPX: end at center of target node
  // For MCPX → servers: 
  //   - 1 node: end at right side (works good as user mentioned)
  //   - 2+ nodes: end at center of node
  const nodesInColumn = typeof data?.nodesInColumn === 'number' ? data.nodesInColumn : undefined;
  const shouldConnectToCenterForMultipleNodes = nodesInColumn !== undefined && nodesInColumn > 1;
  
  const adjustedTargetX = isAgentToMcpx 
    ? targetX  // Center for agents
    : shouldConnectToCenterForMultipleNodes
      ? targetX  // Center for 2+ nodes per column
      : targetX + (NODE_WIDTH / 2); // Right side for 1 node
  const adjustedTargetY = targetY; // Keep same Y position
  
  // Create path: MCPX -> connection point -> node (with 50px distance from connection point)
  let pathData: string;
  
  if (isAgentToMcpx) {
    // Agent edges: direct path from agent to MCPX
    const dx = Math.abs(adjustedTargetX - sourceX);
    const dy = Math.abs(adjustedTargetY - sourceY);
    const distance = Math.sqrt(dx * dx + dy * dy);
    const curveOffset = Math.min(distance * 0.25, 60);
    const cp1x = sourceX - curveOffset;
    const cp1y = sourceY;
    const cp2x = adjustedTargetX + curveOffset;
    const cp2y = adjustedTargetY;
    pathData = `M ${sourceX},${sourceY} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${adjustedTargetX},${adjustedTargetY}`;
  } else if (column !== undefined && column >= 0) {
    // Server edges: MCPX -> connection point (horizontal line) -> 50px -> node
    // Path: MCPX to connection point (straight horizontal), then connection point to node (with curve)
    const nodeStartX = connectionPointX + CONNECTION_POINT_TO_NODE_DISTANCE; // 50px after connection point
    const dx = Math.abs(adjustedTargetX - nodeStartX);
    const dy = Math.abs(adjustedTargetY - connectionPointY);
    const distance = Math.sqrt(dx * dx + dy * dy);
    const curveOffset = Math.min(distance * 0.3, 40);
    
    // MCPX to connection point (horizontal line, Y-aligned with MCPX center)
    // Connection point to node (curved)
    const cp1x = nodeStartX + curveOffset;
    const cp1y = connectionPointY;
    const cp2x = adjustedTargetX - curveOffset;
    const cp2y = adjustedTargetY;
    
    // Full path: MCPX to connection point (horizontal line) then connection point to node (curved)
    pathData = `M ${sourceX},${sourceY} L ${connectionPointX},${connectionPointY} L ${nodeStartX},${connectionPointY} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${adjustedTargetX},${adjustedTargetY}`;
  } else {
    // Fallback: direct path
    const dx = Math.abs(adjustedTargetX - sourceX);
    const dy = Math.abs(adjustedTargetY - sourceY);
    const distance = Math.sqrt(dx * dx + dy * dy);
    const curveOffset = Math.min(distance * 0.25, 60);
    const cp1x = sourceX + curveOffset;
    const cp1y = sourceY;
    const cp2x = adjustedTargetX - curveOffset;
    const cp2y = adjustedTargetY;
    pathData = `M ${sourceX},${sourceY} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${adjustedTargetX},${adjustedTargetY}`;
  }

  // Determine stroke color: use secondary color for AI agent connections
  const strokeColor = isAgentToMcpx 
    ? "#6B6293"  // Secondary border color for AI agents
    : (style.stroke || "#DDDCE4"); // Default or style color for servers

  return (
    <>
      {/* Main connection line */}
      <path
        id={id}
        style={style}
        className="react-flow__edge-path"
        d={pathData}
        stroke={strokeColor}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Animated dashed line for active connections - full path including MCPX to connection point */}
      {data?.animated && (
        <>
          <path
            style={{ ...style, zIndex: 10 }}
            className="react-flow__edge-path"
            d={pathData}
            stroke="#B4108B"
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="8,4"
            opacity={0.9}
          />
          {/* Subtle glow effect for active connections */}
          <path
            style={{ ...style, zIndex: 9 }}
            d={pathData}
            stroke="#B4108B"
            strokeWidth={6}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.15}
            filter="blur(1px)"
          />
        </>
      )}
    </>
  );
};

export default CustomCurvedEdge;