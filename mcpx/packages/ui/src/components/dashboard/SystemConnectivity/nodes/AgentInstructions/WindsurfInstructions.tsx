import React from "react";

export const WindsurfInstructions: React.FC = () => {
  return (
    <div className="space-y-3">
      <div>
        <p className=" font-semibold  text-[#1E1B4B] mb-4">
          Connect with Windsurf
        </p>
        <ol
          className="list-decimal list-inside "
          style={{ fontSize: "16px", color: "#1E1B4B", fontWeight: 400 }}
        >
          <li>In Windsurf, go to Settings → MCP Configuration</li>
          <li>
            Add the configuration JSON from the JSON Config tab to your MCP
            settings
          </li>
          <li>Restart Windsurf for the changes to take effect</li>
        </ol>
      </div>
    </div>
  );
};
