import React from "react";
import { getMcpxServerURL } from "@/config/api-config";

export const CodexInstructions: React.FC = () => {
  const mcpxUrl = getMcpxServerURL("http");

  return (
    <div className="space-y-3 text-sm text-[#1E1B4B]">
      <div>
        <div>
          <p className="font-semibold mb-2">Option 1: Edit config file</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>In Codex Desktop, go to Settings → Settings</li>
            <li>In the left sidebar, select Configuration</li>

            <li>
              Click "Edit config.toml" and open{" "}
              <code className="bg-gray-100 px-1 rounded">
                .codex/config.toml
              </code>{" "}
              to edit the config file using the configuration in the toml config
              tab
            </li>
            <li>
              Save your updated{" "}
              <code className="bg-gray-100 px-1 rounded">
                .codex/config.toml
              </code>{" "}
              and restart Codex to ensure all tools and integrations are
              properly loaded and available
            </li>
          </ol>
        </div>
        <div>
          <p className="font-semibold mb-2 mt-6">
            Option 2: Connect with Codex Desktop
          </p>
          <ol className="list-decimal list-inside space-y-1">
            <li>In Codex Desktop, go to Settings → Settings</li>
            <li>In the left sidebar, select MCP Servers</li>
            <li>Click Add Server</li>
            <li>
              Choose <span className="font-semibold">Streamable HTTP</span> as
              the transport, then fill in the following details:
              <ul className="list-disc list-inside ml-4 mt-1">
                <li>
                  <span className="font-semibold">Name: </span>
                  <code className="bg-gray-100 px-1 rounded">mcpx</code>
                </li>
                <li>
                  <span className="font-semibold">URL: </span>
                  <code className="bg-gray-100 px-1 rounded">{`${mcpxUrl}/mcp`}</code>
                </li>
              </ul>
            </li>
            <li>Click Save</li>
          </ol>
        </div>
      </div>

      <div className="bg-[#EBE6FB] border border-gray-200 rounded-lg p-6">
        <p className="font-semibold mb-4">Important Note</p>
        <p>
          MCPX will expose the available tools, however they are not yet
          accessible for use. Please close and restart Codex to ensure all tools
          and integrations are properly loaded and available. If you don't see
          codex in the mcpx ui, try to ask codex which mcp tools are connected.
        </p>
      </div>
    </div>
  );
};
