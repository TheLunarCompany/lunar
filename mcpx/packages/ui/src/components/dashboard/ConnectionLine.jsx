import React from "react";

const ConnectionLine = ({ active, direction = "to-right" }) => {
  const arrowId = `arrow-${direction}`;
  const lineClass = active
    ? "stroke-[var(--color-fg-success)] pulsing-line"
    : "stroke-[var(--color-text-disabled)]";

  // Simplified coordinates for a horizontal line of length 120
  const x1 = direction === "to-right" ? 0 : 120;
  const y1 = 10; // Midpoint vertically
  const x2 = direction === "to-right" ? 120 : 0;
  const y2 = 10;

  return (
    <svg
      width="120"
      height="20"
      xmlns="http://www.w3.org/2000/svg"
      className="overflow-visible"
    >
      <defs>
        <marker
          id={arrowId}
          markerWidth="10"
          markerHeight="7"
          refX={direction === "to-right" ? "8" : "2"} // Adjusted for arrow head position
          refY="3.5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polyline
            points="0,0 5,3.5 0,7"
            fill="none"
            className={
              active
                ? "stroke-[var(--color-fg-success)]"
                : "stroke-[var(--color-text-disabled)]"
            }
            strokeWidth="1.5"
          />
        </marker>
      </defs>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        className={`${lineClass} stroke-2`}
        markerEnd={direction === "to-right" ? `url(#${arrowId})` : null}
        markerStart={direction === "to-left" ? `url(#${arrowId})` : null}
      />
    </svg>
  );
};

export default ConnectionLine;
