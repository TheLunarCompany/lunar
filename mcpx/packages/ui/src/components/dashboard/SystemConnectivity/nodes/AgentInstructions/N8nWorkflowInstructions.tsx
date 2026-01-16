import React from "react";
import { getMcpxServerURL } from "@/config/api-config";
import { SquarePlus } from "lucide-react";

export const N8nWorkflowInstructions: React.FC = () => {
  const mcpxUrl = getMcpxServerURL("http");
  return (
    <div>
      <div>
        <p className="font-semibold text-[#1E1B4B] mb-4">
          Connect with an n8n workflow
        </p>
        <ol
          className="list-decimal list-inside"
          style={{ fontSize: "16px", color: "#1E1B4B", fontWeight: 400 }}
        >
          <li>Open a workflow you want to add MCPX integration into</li>

          <li>
            Click on the <SquarePlus className="h-4 w-4 inline" /> button
          </li>
          <li>
            In the menu opened, search for "
            <span className="font-semibold">mcp client</span>" and click it
          </li>
          <li>
            Fill in the following details:
            <ul
              className="list-disc list-inside ml-4"
              style={{ fontSize: "16px", color: "#1E1B4B", fontWeight: 400 }}
            >
              <li>
                <span className="font-semibold">Server Transport: </span>{" "}
                <code className="bg-gray-100 px-1 rounded">
                  {" "}
                  HTTP Streamable
                </code>
              </li>
              <li>
                <span className="font-semibold">MCP Endpoint URL: </span>
                {mcpxUrl.includes("localhost") ? (
                  <code className="bg-gray-100 px-1 rounded">
                    http://host.docker.internal:9000/mcp
                  </code>
                ) : (
                  <code className="bg-gray-100 px-1 rounded">{mcpxUrl}</code>
                )}
              </li>

              <li>
                <span className="font-semibold">Authentication: </span>
                {mcpxUrl.includes("localhost") ? (
                  "None"
                ) : (
                  <code className="bg-gray-100 px-1 rounded">MCP OAuth2 </code>
                )}
              </li>
              <li>
                <span className="font-semibold">Tool:</span> choose desired tool
                from mcpx allowlist
              </li>
            </ul>
          </li>
          <br></br>
          <p> You should now see it appears in the UI</p>
        </ol>
      </div>
    </div>
  );
};
