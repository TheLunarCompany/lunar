import React from "react";

export const InspectorInstructions: React.FC = () => {
  return (
    <div className="space-y-3">
      <div>
        <p className=" font-semibold  text-[#1E1B4B] mb-4">
          Connect with MCP Inspector
        </p>
        <ol
          className="list-decimal list-inside "
          style={{ fontSize: "16px", color: "#1E1B4B", fontWeight: 400 }}
        >
          <li>Open MCP Inspector and navigate to the configuration section</li>
          <li>Add the configuration JSON from the JSON Config tab</li>
          <li>Save and restart MCP Inspector to connect to MCPX</li>
        </ol>
      </div>
    </div>
  );
};
