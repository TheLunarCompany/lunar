import React from "react";
import { getAgentConfigs } from "./agentConfigs";
import type { CustomMcpConfig } from "./agentConfigs";

export const CustomInstructions: React.FC = () => {
  const config = getAgentConfigs().find((agent) => agent.value === "custom");

  if (!config || "mcpServers" in config || "servers" in config) {
    return null;
  }

  const customConfig = config?.getConfig() as CustomMcpConfig;

  return (
    <div className="space-y-3">
      <div>
        <p className="font-semibold text-[#1E1B4B] mb-4">
          {config.description}
        </p>
      </div>

      <div>
        <p className="text-[#1E1B4B] mb-4">{customConfig.description}</p>
      </div>

      <div>
        <p
          className="font-semibold text-[#1E1B4B] mb-2"
          style={{
            color: "#1E1B4B",
            fontFamily: "Inter",
            fontSize: "16px",
            fontStyle: "normal",
            fontWeight: 600,
            lineHeight: "140%",
          }}
        >
          {customConfig.streamableHttpExample.transport} Example
        </p>
        <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
          <code>{customConfig.streamableHttpExample.code}</code>
        </pre>
      </div>

      <div>
        <p
          className="font-semibold text-[#1E1B4B] mb-2"
          style={{
            color: "#1E1B4B",
            fontFamily: "Inter",
            fontSize: "16px",
            fontStyle: "normal",
            fontWeight: 600,
            lineHeight: "140%",
          }}
        >
          {customConfig.sseExample.transport} Example
        </p>
        <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
          <code>{customConfig.sseExample.code}</code>
        </pre>
      </div>

      <div>
        <p
          className="font-semibold text-[#1E1B4B] mb-2"
          style={{
            color: "#1E1B4B",
            fontFamily: "Inter",
            fontSize: "16px",
            fontStyle: "normal",
            fontWeight: 600,
            lineHeight: "140%",
          }}
        >
          Client Setup
        </p>
        <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
          <code>{customConfig.clientSetup.code}</code>
        </pre>
      </div>
    </div>
  );
};
