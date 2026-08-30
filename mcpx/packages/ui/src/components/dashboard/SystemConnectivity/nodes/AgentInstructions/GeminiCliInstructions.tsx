import React, { useState } from "react";
import { getMcpxServerURL } from "@/config/api-config";
import { CheckCircle, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

export const GeminiCliInstructions: React.FC = () => {
  const mcpxUrl = getMcpxServerURL("http");
  const [copied, setCopied] = useState(false);
  const commandText = `gemini mcp add --transport http mcpx ${mcpxUrl}/mcp --scope user`;

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
    <div className="text-sm text-[#1E1B4B]">
      <div>
        <p className="font-semibold mb-4">Connect with Gemini CLI</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>
            Make sure the Gemini CLI is installed:{" "}
            <code className="bg-gray-100 px-1 rounded">
              npm install -g @google/gemini-cli
            </code>
          </li>
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
                className="absolute top-2 right-2 h-7 w-7 p-0 flex items-center justify-center hover:opacity-70 transition-opacity"
              >
                {copied ? (
                  <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-gray-600" />
                )}
              </Button>
            </div>
          </li>
          <li>Restart Gemini CLI to pick up the new MCP server</li>
          <li>
            Run <code className="bg-gray-100 px-1 rounded">/mcp</code> to
            confirm mcpx is connected
          </li>
          {!mcpxUrl.includes("localhost") && (
            <li>
              If mcpx shows as not authenticated, run{" "}
              <code className="bg-gray-100 px-1 rounded">/mcp auth mcpx</code>{" "}
              and complete the browser login
            </li>
          )}
        </ol>
      </div>
    </div>
  );
};
