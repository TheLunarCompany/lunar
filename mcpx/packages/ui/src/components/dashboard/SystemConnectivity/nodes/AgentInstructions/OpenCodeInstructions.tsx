import React from "react";
import { getMcpxServerURL } from "@/config/api-config";

export const OpenCodeInstructions: React.FC = () => {
  const mcpxUrl = getMcpxServerURL("http");
  return (
    <div className="space-y-3 text-sm text-[#1E1B4B]">
      <div>
        <p className="font-semibold mb-4">Connect with OpenCode</p>
        <ol className="list-decimal list-inside space-y-2">
          <li>
            Make sure OpenCode is installed:{" "}
            <code className="bg-gray-100 px-1 rounded">
              npm i -g opencode-ai
            </code>
          </li>
          <li>
            Open OpenCode using the{" "}
            <code className="bg-gray-100 px-1 rounded">opencode</code> command
            in the terminal (not{" "}
            <code className="bg-gray-100 px-1 rounded">opencode-ai</code>)
          </li>
          <li>
            Open the global config at{" "}
            <code className="bg-gray-100 px-1 rounded">
              ~/.config/opencode/opencode.json
            </code>
            :
            <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
              <li>
                No folder yet:{" "}
                <code className="bg-gray-100 px-1 rounded">
                  mkdir -p ~/.config/opencode && touch
                  ~/.config/opencode/opencode.json
                </code>
              </li>
              <li>
                Folder exists, no file:{" "}
                <code className="bg-gray-100 px-1 rounded">
                  touch ~/.config/opencode/opencode.json
                </code>
              </li>
            </ul>
          </li>
          <li>
            Add the configuration (keep the JSON valid):
            <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
              <li>
                New file: paste the full configuration from the JSON config tab.
              </li>
              <li>
                Existing file: add{" "}
                <code className="bg-gray-100 px-1 rounded">mcpx</code> as a key
                inside the existing{" "}
                <code className="bg-gray-100 px-1 rounded">mcp</code> object.
              </li>
              <li>
                No <code className="bg-gray-100 px-1 rounded">mcp</code> object
                yet: add one at the root level (sibling of{" "}
                <code className="bg-gray-100 px-1 rounded">$schema</code>,{" "}
                <code className="bg-gray-100 px-1 rounded">model</code>,{" "}
                <code className="bg-gray-100 px-1 rounded">provider</code>,
                etc.).
              </li>
            </ul>
          </li>
          <li>Save the file and restart OpenCode to pick it up</li>
          {!mcpxUrl.includes("localhost") && (
            <li>
              If mcpx shows as not authenticated, run{" "}
              <code className="bg-gray-100 px-1 rounded">
                opencode mcp auth mcpx
              </code>{" "}
              and complete the browser login
            </li>
          )}
        </ol>
      </div>
    </div>
  );
};
