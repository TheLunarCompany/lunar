import { Plus } from "lucide-react";
import React from "react";

export const WarpInstructions: React.FC = () => {
  return (
    <div className="space-y-3 text-sm text-[#1E1B4B]">
      <div>
        <p className="font-semibold mb-4">Connect with Warp</p>
        <ol className="list-decimal list-inside space-y-2">
          <li>
            In Warp, open Settings: use the command palette at the top, search
            for "settings" and select <strong>Open Settings</strong>
          </li>
          <li>
            Click <strong>Agents</strong> → <strong>MCP Servers</strong>
          </li>
          <li>
            Click{" "}
            <strong className="inline-flex items-center gap-0.5">
              Add <Plus className="w-3 h-3" />
            </strong>{" "}
            or, if you've connected to MCPX before (e.g. from Claude Code or
            Codex), scroll down, find{" "}
            <code className="bg-gray-100 px-1 rounded">mcpx</code>, and click
            the , and click the <Plus className="w-3 h-3 inline" /> button
          </li>
          <li>Copy and paste the configuration from the JSON config tab</li>
          <li>
            Click <strong>Save</strong>
          </li>
        </ol>
      </div>
    </div>
  );
};
