import React from "react";
import { getMcpxServerURL } from "@/config/api-config";

export const ChatGPTInstructions: React.FC = () => {
  const mcpxUrl = getMcpxServerURL("http");
  if (mcpxUrl.includes("localhost")) {
    return (
      <div>
        <div>
          <p className="font-semibold text-[#1E1B4B] mb-4">
            Connect with ChatGPT
          </p>
          <p>
            ChatGPT cannot connect to MCPX when it is running on{" "}
            <code className="bg-gray-100 px-1 rounded">localhost</code>.
            <br></br>
            OAuth-based MCP connections require a publicly reachable HTTPS
            endpoint.
            <br></br>To connect ChatGPT to MCPX, you must deploy MCPX behind:
            <ul
              className="list-disc list-inside ml-4"
              style={{ fontSize: "16px", color: "#1E1B4B", fontWeight: 400 }}
            >
              <li>TLS (SSL)</li>
              <li>An Identity-Aware Proxy (IAP) that supports OAuth</li>
            </ul>
            <br></br>
            If you do not want to operate this infrastructure yourself, use the
            MCPX Enterprise deployment, which provides this out of the box.
            <br></br>
            <span className="font-semibold">Live demo:</span>{" "}
            <a
              href="https://www.lunar.dev/demo"
              className="text-blue-500 underline"
              target="_blank"
              title="Watch live demo"
            >
              https://www.lunar.dev/demo{" "}
            </a>
          </p>
        </div>
      </div>
    );
  }
  return (
    <div>
      <div>
        <p className="font-semibold text-[#1E1B4B] mb-4">
          Connect with ChatGPT
        </p>
        <ol
          className="list-decimal list-inside"
          style={{ fontSize: "16px", color: "#1E1B4B", fontWeight: 400 }}
        >
          <li>
            In{" "}
            <code className="bg-gray-100 px-1 rounded">
              {" "}
              https://chatgpt.com
            </code>
            , open the left sidebar and click "Apps"
          </li>
          <li>
            Make sure "Developer mode" is enabled:
            <ol
              className=" list-inside ml-4"
              style={{
                listStyleType: "lower-roman",
                fontSize: "16px",
                color: "#1E1B4B",
                fontWeight: 400,
              }}
            >
              <li>
                Click the "Setting" icon (top right corner) and select "Apps" if
                not selected.
              </li>
              <li>
                {" "}
                Then click on "Advanced settings" and enable Developer mode.
              </li>
            </ol>
          </li>
          <li>
            Go back to "Apps" (still inside the settings) and click "Create app"
          </li>
          <li>
            Fill in the following details:
            <ul
              className="list-disc list-inside ml-4"
              style={{ fontSize: "16px", color: "#1E1B4B", fontWeight: 400 }}
            >
              <li>
                <span className="font-semibold">Name:</span>{" "}
                <code className="bg-gray-100 px-1 rounded">MCPX</code>
              </li>
              <li>
                <span className="font-semibold">MCP Server URL:</span>{" "}
                <code className="bg-gray-100 px-1 rounded">
                  {" "}
                  {`${mcpxUrl}/mcp`}
                </code>
              </li>
              <li>
                <span className="font-semibold">Authentication:</span> OAuth
                (enabled)
              </li>
            </ul>
          </li>
          <li>
            Click "Create" at the bottom right.
            <br></br>
            <br></br>
            You should now see it appears in the UI
          </li>
        </ol>
      </div>
    </div>
  );
};
