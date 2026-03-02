import React from "react";

export const CursorInstructions: React.FC = () => {
  return (
    <div className="space-y-3">
      <div>
        <p className=" font-semibold  text-[#1E1B4B] mb-4">
          Connect with Cursor
        </p>
        <ol
          className="list-decimal list-inside "
          style={{ fontSize: "16px", color: "#1E1B4B", fontWeight: 400 }}
        >
          <li>In Cursor, go to Settings → Cursor Settings → Tools & MCP</li>
          <li>
            Click on "Add Custom MCP" to open the file{" "}
            <code className="bg-gray-100 px-1 rounded">~/.cursor/mcp.json</code>
          </li>
          <li>
            Setup the connection to MCPX using the configuration in the json
            config tab
          </li>
          <li>The MCPX instance is now running locally on port 9000</li>
          <li>
            Back in the Tools & MCP section you should now see MCPX under MCP
            Tools
          </li>
        </ol>
      </div>

      <div className="bg-[#EBE6FB] border border-gray-200 rounded-lg p-6 ">
        <p className="font-semibold font-[16px]  text-[#1E1B4B] mb-4">
          Important Note
        </p>
        <p>
          MCPX will expose the available tools which are set up in{" "}
          <code className="bg-gray-100 px-1 rounded">~/.cursor/mcp.json</code>,
          however they are not yet accessible for use. Please close and restart
          Cursor Code Editor to ensure all tools and integrations are properly
          loaded and available.
        </p>
      </div>
    </div>
  );
};
