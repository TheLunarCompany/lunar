import React from "react";

export const CopilotInstructions: React.FC = () => {
  return (
    <div className="space-y-3 text-sm text-mcpx-text">
      <div>
        <p className="font-semibold mb-4">Connect with VSCode</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>
            In VSCode, open a file{" "}
            <code className="bg-mcpx-surface-tertiary px-1 rounded">
              .vscode/mcp.json
            </code>
          </li>
          <li>
            Go to the file, click "Add server" (at the right bottom of the
            screen)
          </li>
          <li>
            Select{" "}
            <code className="bg-mcpx-surface-tertiary px-1 rounded">HTTP</code>{" "}
            and paste the MCPX url from the configuration in the json config tab
          </li>
          <li>
            You should see that the server is added to the file with a default
            name
          </li>
          <li>
            Change the default name from{" "}
            <code className="bg-mcpx-surface-tertiary px-1 rounded">
              "my-mcp-server-XXXXXXXX"
            </code>{" "}
            to{" "}
            <code className="bg-mcpx-surface-tertiary px-1 rounded">
              "mcpx"
            </code>
          </li>
          <li>
            Right over the name{" "}
            <code className="bg-mcpx-surface-tertiary px-1 rounded">
              "mcpx"
            </code>{" "}
            you should see a "start" button, click it and see it appears in the
            UI
          </li>
        </ol>
      </div>

      <div className="bg-mcpx-selected-weak border border-mcpx-border-subtle rounded-lg p-6">
        <p className="font-semibold mb-4">Important Note</p>
        <p>
          MCPX will expose the available tools which are set up in{" "}
          <code className="bg-mcpx-surface-tertiary px-1 rounded">
            .vscode/mcp.json
          </code>
          , however they are not yet accessible for use. Please close and
          restart VSCode to ensure all tools and integrations are properly
          loaded and available.
        </p>
      </div>
    </div>
  );
};
