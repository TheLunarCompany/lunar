import React from "react";

const CurvedConnectionLine = ({
  startX,
  startY,
  endX,
  endY,
  active,
  lineId,
}) => {
  const arrowId = `arrow-${lineId}`;
  const lineClass = active
    ? "stroke-[var(--color-fg-success)] pulsing-line"
    : "stroke-[var(--color-text-disabled)]";

  // Control point calculation for a gentle curve
  // Midpoint
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;

  // Perpendicular direction
  const dx = endX - startX;
  const dy = endY - startY;

  // Distance of control point from midpoint
  const curveFactor = Math.sqrt(dx * dx + dy * dy) * 0.15; // Adjust for more/less curve

  // Control point (offset perpendicularly from midpoint)
  // For a line from left to right, curve "outwards" (e.g., downwards if horizontal)
  // If startX < endX (left to right), make control point Y larger (curve down)
  // If startX > endX (right to left), make control point Y smaller (curve up)
  let controlX, controlY;

  if (Math.abs(dx) > Math.abs(dy)) {
    // More horizontal
    controlX = midX;
    controlY = midY + (startX < endX ? curveFactor : -curveFactor);
    if (endX < startX && startY > endY) controlY = midY - curveFactor; // Special case for bottom-right to top-left
    if (endX < startX && startY < endY) controlY = midY + curveFactor; // Special case for top-right to bottom-left
  } else {
    // More vertical
    controlY = midY;
    controlX = midX + (startY < endY ? -curveFactor : curveFactor); // Curve left/right
  }

  const pathData = `M ${startX},${startY} Q ${controlX},${controlY} ${endX},${endY}`;

  // Calculate arrow orientation
  const angle = Math.atan2(endY - controlY, endX - controlX) * (180 / Math.PI);

  return (
    <svg
      className="overflow-visible absolute pointer-events-none"
      style={{ left: 0, top: 0, width: "100%", height: "100%" }}
    >
      <defs>
        <marker
          id={arrowId}
          markerWidth="12"
          markerHeight="12"
          refX="7"
          refY="3.5"
          orient="auto-start-reverse" // For quadratic Bezier, use this or calculate angle
          markerUnits="strokeWidth"
        >
          <path
            d="M0,0 L5,3.5 L0,7 Z"
            className={
              active
                ? "fill-[var(--color-fg-success)]"
                : "fill-[var(--color-text-disabled)]"
            }
          />
        </marker>
      </defs>
      <path
        d={pathData}
        className={`${lineClass} stroke-2 fill-none`}
        markerEnd={`url(#${arrowId})`}
      />
    </svg>
  );
};

export default CurvedConnectionLine;
