import React, { useCallback, useState } from "react";
import { CheckCircle, Copy } from "lucide-react";
import { getAgentConfigs } from "./agentConfigs";
import type { CustomMcpConfig } from "./agentConfigs";

function CopyableCodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div className="relative group">
      <button
        onClick={() => void handleCopy()}
        className="absolute top-2 right-2 z-10 h-7 w-7 p-0 flex items-center justify-center hover:opacity-70 transition-opacity"
        title={copied ? "Copied!" : "Copy"}
        type="button"
      >
        {copied ? (
          <CheckCircle className="h-3.5 w-3.5 text-green-600" />
        ) : (
          <Copy className="h-3.5 w-3.5 text-gray-600" />
        )}
      </button>
      <pre className="bg-gray-100 p-4 pr-10 rounded-lg overflow-x-auto text-sm">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export const CustomInstructions: React.FC = () => {
  const config = getAgentConfigs().find((agent) => agent.value === "custom");

  if (!config || "mcpServers" in config || "servers" in config) {
    return null;
  }

  const customConfig = config?.getConfig() as CustomMcpConfig;

  return (
    <div className="space-y-3 text-sm text-[#1E1B4B]">
      <div>
        <p className="font-semibold mb-4">{config.description}</p>
      </div>

      <div>
        <p className="mb-4">{customConfig.description}</p>
      </div>

      <div>
        <p className="font-semibold mb-2">
          {customConfig.streamableHttpExample.transport} Example
        </p>
        <CopyableCodeBlock code={customConfig.streamableHttpExample.code} />
      </div>

      <div>
        <p className="font-semibold mb-2">
          {customConfig.sseExample.transport} Example
        </p>
        <CopyableCodeBlock code={customConfig.sseExample.code} />
      </div>

      <div>
        <p className="font-semibold mb-2">Client Setup</p>
        <CopyableCodeBlock code={customConfig.clientSetup.code} />
      </div>
    </div>
  );
};
