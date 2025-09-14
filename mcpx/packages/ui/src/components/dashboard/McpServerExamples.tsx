import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, CheckCircle } from "lucide-react";
import { useState } from "react";

interface McpServerExample {
  value: string;
  label: string;
  description: string;
  config: any;
}

const MCP_SERVER_EXAMPLES: McpServerExample[] = [
  {
    value: "memory",
    label: "Memory (stdio-npx)",
    description:
      "MCP server for memory operations with custom file path configuration",
    config: {
      memory: {
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-memory"],
        env: {
          MEMORY_FILE_PATH: "/lunar/packages/mcpx-server/config/memory.json",
        },
      },
    },
  },
  {
    value: "sequentialthinking",
    label: "Sequential Thinking (stdio-docker)",
    description: "MCP server for sequential thinking operations using Docker",
    config: {
      sequentialthinking: {
        command: "docker",
        args: ["run", "--rm", "-i", "mcp/sequentialthinking"],
      },
    },
  },
  {
    value: "time",
    label: "Time (stdio-uvx)",
    description:
      "MCP server for time-related operations with local timezone support",
    config: {
      time: {
        command: "uvx",
        args: ["mcp-server-time", "--local-timezone=America/New_York"],
      },
    },
  },
  {
    value: "notion",
    label: "Notion (remote-StreamableHttp)",
    description: "MCP server for Notion integration via HTTP streaming",
    config: {
      notion: {
        url: "https://mcp.notion.com/mcp",
        type: "streamable-http",
      },
    },
  },
  {
    value: "atlassian",
    label: "Atlassian (remote-sse)",
    description: "MCP server for Atlassian integration via Server-Sent Events",
    config: {
      atlassian: {
        url: "https://mcp.atlassian.com/v1/sse",
        type: "sse",
      },
    },
  },
];

interface McpServerExamplesProps {
  selectedExample: string;
  onExampleChange: (value: string) => void;
  onUseExample: (config: any, name: string) => void;
}

export const McpServerExamples = ({
  selectedExample,
  onExampleChange,
  onUseExample,
}: McpServerExamplesProps) => {
  const [copied, setCopied] = useState(false);

  const selectedExampleConfig = MCP_SERVER_EXAMPLES.find(
    (example) => example.value === selectedExample,
  );

  const handleCopyConfig = async () => {
    if (!selectedExampleConfig) return;

    try {
      await navigator.clipboard.writeText(
        JSON.stringify(selectedExampleConfig.config, null, 2),
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy configuration:", err);
    }
  };

  const handleUseExample = () => {
    if (!selectedExampleConfig) return;
    onUseExample(selectedExampleConfig.config, selectedExampleConfig.value);
  };

  return (
    <div className="space-y-4">
      <div className="bg-[var(--color-bg-neutral)] border border-[var(--color-border-primary)] rounded-lg p-4">
        <h4 className="font-medium text-[var(--color-text-primary)] mb-2">
          MCP Server Examples
        </h4>
        <p className="text-sm text-[var(--color-text-secondary)] mb-3">
          Choose from these example MCP server configurations to get started.
        </p>
        <div className="space-y-3">
          <Label className="text-sm font-medium mb-2 block">
            Select Server Type
          </Label>
          <Select value={selectedExample} onValueChange={onExampleChange}>
            <SelectTrigger className="w-full bg-[var(--color-bg-container)] border border-[var(--color-border-primary)] rounded-lg p-3">
              <SelectValue placeholder="Choose a server example..." />
            </SelectTrigger>
            <SelectContent>
              {MCP_SERVER_EXAMPLES.map((example) => (
                <SelectItem key={example.value} value={example.value}>
                  {example.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedExampleConfig && (
            <div className="space-y-3">
              <p className="text-sm text-[var(--color-text-secondary)]">
                {selectedExampleConfig.description}
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={handleUseExample}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  Use This Example
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedExampleConfig && (
        <>
          <div className="bg-[var(--color-bg-neutral)] border border-[var(--color-border-primary)] rounded-lg p-4">
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-[var(--color-text-primary)]">
                  Configuration Preview
                </h4>
                <Button
                  onClick={handleCopyConfig}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-[var(--color-bg-interactive-hover)]"
                >
                  {copied ? (
                    <CheckCircle className="w-4 h-4 text-[var(--color-fg-success)]" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <pre className="bg-[var(--color-bg-container)] p-3 rounded text-xs overflow-x-auto overflow-y-auto max-h-64 font-mono text-[var(--color-text-primary)]">
                {JSON.stringify(selectedExampleConfig.config, null, 2)}
              </pre>
            </div>
          </div>

          <div className="bg-[var(--color-bg-neutral)] border border-[var(--color-border-primary)] rounded-lg p-4">
            <h4 className="font-medium text-[var(--color-text-primary)] mb-2">
              Setup Instructions
            </h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-[var(--color-text-secondary)]">
              <li>Select a server example from the dropdown above</li>
              <li>Click "Use This Example" to load the configuration</li>
              <li>Update any API keys or environment variables as needed</li>
              <li>Customize the server name and other settings if desired</li>
              <li>Click "Add Server" to add it to your configuration</li>
            </ol>
          </div>
        </>
      )}
    </div>
  );
};
