import React from "react";

export const ClaudeInstructions: React.FC = () => {
  return (
    <div className="space-y-3">
      <div>
        <p className=" font-semibold  text-[#1E1B4B] mb-4">
          Connect with Claude Desktop
        </p>
        <ol
          className="list-decimal list-inside "
          style={{ fontSize: "16px", color: "#1E1B4B", fontWeight: 400 }}
        >
          <li>In Claude Desktop, go to Settings → Developer</li>
          <li>
            Click "Edit Config" and open{" "}
            <code className="bg-gray-100 px-1 rounded">
              claude_desktop_config.json
            </code>{" "}
            to edit the config file using the configuration in the json config
            tab
          </li>
          <li>
            Save your updated{" "}
            <code className="bg-gray-100 px-1 rounded">
              claude_desktop_config.json
            </code>{" "}
            and restart Claude to ensure all tools and integrations are properly
            loaded and available
          </li>
        </ol>
      </div>

      <div className="bg-[#EBE6FB] border border-gray-200 rounded-lg p-6 ">
        <p className="font-semibold font-[16px]  text-[#1E1B4B] mb-4">
          Important Note
        </p>
        <p>
          MCPX will expose the available tools which are set up in{" "}
          <code className="bg-gray-100 px-1 rounded">
            claude_desktop_config.json
          </code>
          , however they are not yet accessible for use. Please close and
          restart Claude to ensure all tools and integrations are properly
          loaded and available.
        </p>
      </div>
    </div>
  );
};
