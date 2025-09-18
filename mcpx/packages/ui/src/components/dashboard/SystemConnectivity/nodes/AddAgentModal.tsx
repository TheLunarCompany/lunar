import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, CheckCircle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";

interface AddAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AgentType {
  value: string;
  label: string;
  description: string;
  config: any;
}

const AGENT_TYPES: AgentType[] = [
  {
    value: "cursor",
    label: "Cursor",
    description: "Connect Cursor to MCPX for MCP tool integration",
    config: {
      mcpServers: {
        mcpx: {
          url: "http://127.0.0.1:9000/mcp",
        },
      },
    },
  },
  {
    value: "claude",
    label: "Claude Desktop",
    description: "Connect Claude Desktop to MCPX for MCP tool integration",
    config: {
      mcpServers: {
        mcpx: {
          command: "npx",
          args: [
            "mcp-remote@0.1.21",
            "http://localhost:9000/mcp",
            "--header",
            "x-lunar-consumer-tag: Claude",
          ],
        },
      },
    },
  },
  {
    value: "custom",
    label: "Custom MCP Client",
    description: "Connect your custom MCP client to MCPX",
    config: {
      description:
        "MCPX is essentially a MCP server, just like any other. Connecting to it using the SDK is similar to any MCP integration. Because MCPX adopts a remote-first approach - that is, it is meant to be deployed on the cloud - it accepts SSE connections and not stdio ones.",
      streamableHttpExample: {
        transport: "StreamableHttp",
        code: `const transport = new StreamableHTTPClientTransport(
  new URL(\`\${MCPX_HOST}/mcp\`),
  {
    requestInit: {
      headers: {
        "x-lunar-consumer-tag": "my_agent_name",
      },
    },
  }
);`,
      },
      sseExample: {
        transport: "SSE",
        code: `const transport = new SSEClientTransport(new URL(\`\${MCPX_HOST}/sse\`), {
  eventSourceInit: {
    fetch: (url, init) => {
      const headers = new Headers(init?.headers);
      const consumerTag = "my_agent_name";
      headers.set("x-lunar-consumer-tag", consumerTag);
      return fetch(url, { ...init, headers });
    },
  },
});`,
      },
      clientSetup: {
        code: `const client = new Client({
  name: "mcpx-client",
  version: "1.0.0"
});

await client.connect(transport);`,
      },
    },
  },
];

export const AddAgentModal = ({ isOpen, onClose }: AddAgentModalProps) => {
  const [selectedAgentType, setSelectedAgentType] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const selectedConfig = AGENT_TYPES.find(
    (type) => type.value === selectedAgentType,
  );

  const handleCopyConfig = async () => {
    if (!selectedConfig) return;

    try {
      let configToCopy;
      if (selectedConfig.value === "custom") {
        configToCopy = {
          streamableHttp: selectedConfig.config.streamableHttpExample.code,
          sse: selectedConfig.config.sseExample.code,
          clientSetup: selectedConfig.config.clientSetup.code,
        };
      } else {
        configToCopy = selectedConfig.config;
      }

      await navigator.clipboard.writeText(
        JSON.stringify(configToCopy, null, 2),
      );
      setCopied(true);
      toast({
        title: "Configuration copied!",
        description:
          "The agent configuration has been copied to your clipboard.",
      });

      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Failed to copy configuration to clipboard.",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    setSelectedAgentType("");
    setCopied(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col bg-[var(--color-bg-container)] border border-[var(--color-border-primary)] rounded-lg">
        <DialogHeader className="border-b border-[var(--color-border-primary)] pb-6">
          <DialogTitle className="text-lg text-[var(--color-text-primary)]">
            Add AI Agent
          </DialogTitle>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Select your agent type and copy the configuration JSON to get
            started.
          </p>
        </DialogHeader>

        <div className="flex flex-col flex-1 gap-6">
          <div className="space-y-4">
            <Label className="text-sm font-medium">Select Agent Type</Label>
            <Select
              value={selectedAgentType}
              onValueChange={setSelectedAgentType}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose an agent type..." />
              </SelectTrigger>
              <SelectContent>
                {AGENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedConfig && (
            <div className="space-y-4">
              {selectedConfig.value === "custom" ? (
                <div className="space-y-3 text-sm text-[var(--color-text-secondary)] max-h-96 overflow-y-auto pr-2">
                  <div className="bg-[var(--color-bg-neutral)] border border-[var(--color-border-primary)] rounded-lg p-4">
                    <h4 className="font-medium text-[var(--color-text-primary)] mb-2">
                      Connect with Your MCP Client
                    </h4>
                    <p className="mb-3">{selectedConfig.config.description}</p>
                    <p className="mb-3">
                      You may pass extra headers when constructing a Transport
                      in the client app - the one that will be used in order to
                      connect to MCPX. See Basic API Key Auth and ACL for actual
                      extra headers' use-cases.
                    </p>
                  </div>

                  <div className="bg-[var(--color-bg-neutral)] border border-[var(--color-border-primary)] rounded-lg p-4">
                    <h4 className="font-medium text-[var(--color-text-primary)] mb-2">
                      Client Setup
                    </h4>
                    <pre className="bg-[var(--color-bg-container)] p-2 rounded text-xs overflow-x-auto font-mono">
                      {selectedConfig.config.clientSetup.code}
                    </pre>
                  </div>

                  <div className="bg-[var(--color-bg-neutral)] border border-[var(--color-border-primary)] rounded-lg p-4">
                    <h4 className="font-medium text-[var(--color-text-primary)] mb-2">
                      StreamableHttp Transport
                    </h4>
                    <p className="mb-2">
                      This is the recommended way to connect the MCP servers.
                    </p>
                    <pre className="bg-[var(--color-bg-container)] p-2 rounded text-xs overflow-x-auto font-mono">
                      {selectedConfig.config.streamableHttpExample.code}
                    </pre>
                  </div>

                  <div className="bg-[var(--color-bg-neutral)] border border-[var(--color-border-primary)] rounded-lg p-4">
                    <h4 className="font-medium text-[var(--color-text-primary)] mb-2">
                      SSE Transport
                    </h4>
                    <p className="mb-2">
                      This transport is in deprecation, however MCPX still
                      support it to maintain backward compatibility for the time
                      being.
                    </p>
                    <pre className="bg-[var(--color-bg-container)] p-2 rounded text-xs overflow-x-auto font-mono">
                      {selectedConfig.config.sseExample.code}
                    </pre>
                  </div>
                </div>
              ) : (
                <>
                  <Tabs defaultValue="json" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="json">JSON Config</TabsTrigger>
                      <TabsTrigger value="instructions">
                        Instructions
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="json" className="mt-4">
                      <div className="relative">
                        <div className="absolute top-2 right-2 z-10">
                          <Button
                            onClick={handleCopyConfig}
                            variant="secondary"
                            size="sm"
                            className="flex items-center gap-2 bg-white/90 backdrop-blur-sm"
                          >
                            {copied ? (
                              <CheckCircle className="w-4 h-4 text-[var(--color-fg-success)]" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                            {copied ? "Copied!" : "Copy"}
                          </Button>
                        </div>
                        <div className="bg-[var(--color-bg-neutral)] border border-[var(--color-border-primary)] rounded-lg p-4">
                          <pre className="text-xs text-[var(--color-text-primary)] whitespace-pre-wrap overflow-x-auto font-mono">
                            {JSON.stringify(selectedConfig.config, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="instructions" className="mt-4">
                      <div className="space-y-3 text-sm text-[var(--color-text-secondary)]">
                        {selectedConfig.value === "cursor" ? (
                          <>
                            <div className="bg-[var(--color-bg-neutral)] border border-[var(--color-border-primary)] rounded-lg p-4">
                              <h4 className="font-medium text-[var(--color-text-primary)] mb-2">
                                Connect with Cursor
                              </h4>
                              <ol className="list-decimal list-inside space-y-2">
                                <li>
                                  In Cursor, go to{" "}
                                  <strong>
                                    Settings → Cursor Settings → Tools &
                                    Integration
                                  </strong>
                                </li>
                                <li>
                                  Click on <strong>"Add Custom MCP"</strong> to
                                  open the file{" "}
                                  <code className="bg-[var(--color-bg-container)] px-1 rounded">
                                    ~/.cursor/mcp.json
                                  </code>
                                </li>
                                <li>
                                  Setup the connection to MCPX using the
                                  configuration above
                                </li>
                                <li>
                                  In the instance above MCPX is running locally
                                  on port 9000
                                </li>
                                <li>
                                  Back in the Tools & Integration section you
                                  should now see <strong>mcpx</strong> under MCP
                                  Tools
                                </li>
                              </ol>
                            </div>
                            <div className="bg-[var(--color-bg-neutral)] border border-[var(--color-border-primary)] rounded-lg p-4">
                              <h4 className="font-medium text-[var(--color-text-primary)] mb-2">
                                Important Note
                              </h4>
                              <p>
                                MCPX will expose the available tools which are
                                set up in{" "}
                                <code className="bg-[var(--color-bg-container)] px-1 rounded">
                                  /config/mcp.json
                                </code>
                                , however they are not yet accessible for use.
                                Please{" "}
                                <strong>
                                  close and restart Cursor Code Editor
                                </strong>{" "}
                                to ensure all tools and integrations are
                                properly loaded and available.
                              </p>
                            </div>
                          </>
                        ) : selectedConfig.value === "claude" ? (
                          <>
                            <div className="bg-[var(--color-bg-neutral)] border border-[var(--color-border-primary)] rounded-lg p-4">
                              <h4 className="font-medium text-[var(--color-text-primary)] mb-2">
                                Connect with Claude Desktop
                              </h4>
                              <ol className="list-decimal list-inside space-y-2">
                                <li>
                                  In Claude Desktop, go to{" "}
                                  <strong>Settings → Developer</strong>
                                </li>
                                <li>
                                  Open your{" "}
                                  <code className="bg-[var(--color-bg-container)] px-1 rounded">
                                    claude_desktop_config.json
                                  </code>{" "}
                                  and edit your config file using the
                                  configuration below
                                </li>
                                <li>
                                  Save your updated{" "}
                                  <code className="bg-[var(--color-bg-container)] px-1 rounded">
                                    claude_desktop_config.json
                                  </code>{" "}
                                  and restart Claude Desktop for the change to
                                  become effective
                                </li>
                              </ol>
                            </div>
                            <div className="bg-[var(--color-bg-neutral)] border border-[var(--color-border-primary)] rounded-lg p-4">
                              <h4 className="font-medium text-[var(--color-text-primary)] mb-2">
                                Important Note
                              </h4>
                              <p>
                                MCPX will expose the available tools which are
                                set up in{" "}
                                <code className="bg-[var(--color-bg-container)] px-1 rounded">
                                  /config/mcp.json
                                </code>
                                , however they are not yet accessible for use.
                                Please <strong>close and restart Claude</strong>{" "}
                                to ensure all tools and integrations are
                                properly loaded and available.
                              </p>
                            </div>
                          </>
                        ) : null}
                      </div>
                    </TabsContent>
                  </Tabs>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-6 border-t border-[var(--color-border-primary)]"></div>
      </DialogContent>
    </Dialog>
  );
};
