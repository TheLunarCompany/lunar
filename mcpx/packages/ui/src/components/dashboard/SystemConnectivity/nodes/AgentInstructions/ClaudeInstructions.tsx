import React, { useState } from "react";
import { getMcpxServerURL } from "@/config/api-config";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

export const ClaudeDesktopInstructions: React.FC = () => {
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

export const ClaudeCodeInstructions: React.FC = () => {
  const mcpxUrl = getMcpxServerURL("http");
  const [copied, setCopied] = useState(false);
  const commandText = `claude mcp add --transport http mcpx ${mcpxUrl}/mcp --header "x-lunar-consumer-tag: Claude Code" --scope user`;

  const handleCopy = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        description: "Copied to clipboard",
        variant: "info",
      });
      setCopied(true);
      setTimeout(() => setCopied(false), 4000);
    } catch (_err) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };
  return (
    <div>
      <div>
        <p className="font-semibold text-[#1E1B4B] mb-4">
          Connect with Claude Code
        </p>
        <ol
          className="list-decimal list-inside"
          style={{ fontSize: "16px", color: "#1E1B4B", fontWeight: 400 }}
        >
          <li>Open in terminal</li>
          <li>
            Run the following command: <br></br>
            <div className="relative group my-2">
              <pre className="bg-gray-100 p-4 rounded overflow-x-auto whitespace-pre-wrap wrap-break-word">
                <code className="text-sm">{commandText}</code>
              </pre>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(commandText)}
                className="absolute top-2 right-2 h-7 w-7 p-0 bg-white hover:bg-transparent border border-gray-300 hover:border-transparent rounded opacity-0 group-hover:opacity-100 transition-opacity shadow-xs hover:shadow-none"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-gray-600" />
                )}
              </Button>
            </div>
          </li>
          <li>Close and re-open Claude Code in terminal</li>
          <li>
            Run the following command:
            <code className="bg-gray-100 px-1 rounded">/mcp</code> to see
            connected mcp server
          </li>
          <ul
            className="list-disc list-inside ml-4"
            style={{ fontSize: "16px", color: "#1E1B4B", fontWeight: 400 }}
          >
            <li>
              <span className="font-semibold">
                If MCPX server isn't connected, click{" "}
              </span>{" "}
              {!mcpxUrl.includes("localhost") ? (
                <code className="bg-gray-100 px-1 rounded">Authenticate</code>
              ) : (
                <>
                  <code className="bg-gray-100 px-1 rounded">Reconnect</code> or{" "}
                  <code className="bg-gray-100 px-1 rounded">Enable</code>
                </>
              )}
            </li>
          </ul>
          <li>
            You should now see mcpx connected in Claude Code mcp servers list in
            terminal and Claude Code agent appears in the mcpx UI
          </li>
        </ol>
      </div>
    </div>
  );
};
