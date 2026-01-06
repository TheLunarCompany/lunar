import React from "react";

export const CopilotInstructions: React.FC = () => {
  return (
    <div>
      <div>
        <p className="font-semibold text-[#1E1B4B] mb-4">Connect with VSCode</p>
        <ol
          className="list-decimal list-inside"
          style={{ fontSize: "16px", color: "#1E1B4B", fontWeight: 400 }}
        >
          <li>
            In VSCode, open a file{" "}
            <code className="bg-white px-1 rounded">.vscode/mcp.json</code>
          </li>
          <li>
            Go to the file, click "Add server" (at the right bottom of the
            screen)
          </li>
          <li>
            Select <code className="bg-white px-1 rounded">HTTP</code> and paste
            the MCPX url from the configuration in the json config tab
          </li>
          <li>
            You should see that the server is added to the file with a default
            name
          </li>
          <li>
            Change the default name from{" "}
            <code className="bg-white px-1 rounded">
              "my-mcp-server-XXXXXXXX"
            </code>{" "}
            to <code className="bg-white px-1 rounded">"mcpx"</code>
          </li>
          <li>
            Add headers as shown in the configuration in the json config tab
            (with{" "}
            <code className="bg-white px-1 rounded">
              "x-lunar-consumer-tag": "copilot"
            </code>
            )
          </li>
          <li>
            Right over the name{" "}
            <code className="bg-white px-1 rounded">"mcpx"</code> you should see
            a "start" button, click it and see it appears in the UI
          </li>
        </ol>
      </div>

      <div className="bg-[#EBE6FB] border border-gray-200 rounded-lg p-6 ">
        <p className="font-semibold font-[16px]  text-[#1E1B4B] mb-4">
          Important Note
        </p>
        <p>
          MCPX will expose the available tools which are set up in{" "}
          <code className="bg-gray-100 px-1 rounded">.vscode/mcp.json</code>,
          however they are not yet accessible for use. Please close and restart
          VSCode to ensure all tools and integrations are properly loaded and
          available.
        </p>
      </div>
    </div>
  );
};
