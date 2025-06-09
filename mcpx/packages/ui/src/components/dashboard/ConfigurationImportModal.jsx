import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Upload,
  Copy,
  AlertCircle,
  FileText,
  Server,
  Shield,
} from "lucide-react";

const EXAMPLE_MCP_JSON = `{
  "targetServers": [
    {
      "name": "slack",
      "tools": [
        {
          "name": "sendMessage",
          "description": "Post a message to a channel or user",
          "usage": {
            "callCount": 8,
            "lastCalledAt": "2025-05-28T11:59:30Z"
          }
        },
        {
          "name": "createChannel",
          "description": "Create a public or private Slack channel",
          "usage": {
            "callCount": 1,
            "lastCalledAt": "2025-05-28T11:50:00Z"
          }
        }
      ],
      "usage": {
        "callCount": 11,
        "lastCalledAt": "2025-05-28T11:59:30Z"
      }
    }
  ],
  "connectedClients": [
    {
      "sessionId": "sess-20250528-ab55f",
      "usage": {
        "callCount": 12,
        "lastCalledAt": "2025-05-28T11:59:20Z"
      },
      "consumerTag": "marketing",
      "llm": {
        "provider": "gemini",
        "model": "gemini-2.0-flash-exp"
      }
    }
  ],
  "usage": {
    "callCount": 22,
    "lastCalledAt": "2025-05-28T11:59:25Z"
  },
  "lastUpdatedAt": "2025-05-28T12:00:00Z"
}`;

const EXAMPLE_APP_YAML = `# Access Control Configuration
access:
  authentication:
    enabled: true
    method: "token"
  
  authorization:
    default_policy: "deny"
    
  rate_limiting:
    enabled: true
    requests_per_minute: 100

# Server Configuration
server:
  port: 8080
  timeout: 30s`;

export default function ConfigurationImportModal({
  isOpen,
  onConfigurationImport,
  onClose,
  currentConfiguration = null,
}) {
  const [activeTab, setActiveTab] = useState("mcp");
  const [mcpConfigText, setMcpConfigText] = useState(
    JSON.stringify(currentConfiguration, null, 2) || "",
  );
  const [appConfigText, setAppConfigText] = useState("");
  const [error, setError] = useState(null);
  const [isValidating, setIsValidating] = useState(false);

  const validateJSON = (text) => {
    try {
      const parsed = JSON.parse(text);
      if (!parsed.targetServers || !Array.isArray(parsed.targetServers)) {
        throw new Error("Configuration must include 'targetServers' array");
      }
      if (!parsed.connectedClients || !Array.isArray(parsed.connectedClients)) {
        throw new Error("Configuration must include 'connectedClients' array");
      }
      return { valid: true, data: parsed };
    } catch (e) {
      return { valid: false, error: e.message };
    }
  };

  const handleImport = async () => {
    setIsValidating(true);
    setError(null);

    if (!mcpConfigText.trim()) {
      setError("MCP configuration is required.");
      setIsValidating(false);
      return;
    }

    const validation = validateJSON(mcpConfigText);
    if (!validation.valid) {
      setError(`MCP Config Error: ${validation.error}`);
      setIsValidating(false);
      return;
    }

    try {
      await onConfigurationImport({
        mcpConfig: validation.data,
        appConfig: appConfigText, // Pass app config as well, even if not processed
      });
    } catch (e) {
      setError("Failed to import configuration. Please try again.");
    }

    setIsValidating(false);
  };

  const handleFileUpload = (event, configType) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (configType === "mcp") {
          setMcpConfigText(e.target.result);
        } else {
          setAppConfigText(e.target.result);
        }
        setError(null);
      };
      reader.readAsText(file);
    }
  };

  const copyExampleToTextarea = (configType) => {
    if (configType === "mcp") {
      setMcpConfigText(EXAMPLE_MCP_JSON);
    } else {
      setAppConfigText(EXAMPLE_APP_YAML);
    }
    setError(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose || (() => {})}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col bg-[var(--color-bg-container)] border border-[var(--color-border-primary)] rounded-lg">
        <DialogHeader className="border-b border-[var(--color-border-primary)] p-6">
          <DialogTitle className="flex items-center gap-2 text-2xl text-[var(--color-text-primary)]">
            <FileText className="w-6 h-6 text-[var(--color-fg-interactive)]" />
            MCPX System Configuration
          </DialogTitle>
          <p className="text-[var(--color-text-secondary)] mt-2">
            Configure your MCPX system with server definitions and access
            controls.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-hidden p-6">
          {error && (
            <Alert
              variant="destructive"
              className="mb-4 bg-[var(--color-bg-danger)] border-[var(--color-border-danger)] text-[var(--color-fg-danger)]"
            >
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Tab Navigation */}
          <div className="flex space-x-1 mb-4 bg-[var(--color-bg-container-overlay)] p-1 rounded-lg">
            <button
              onClick={() => setActiveTab("mcp")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "mcp"
                  ? "bg-[var(--color-bg-interactive)] text-[var(--color-fg-interactive)] border border-[var(--color-border-interactive)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <Server className="w-4 h-4" />
              mcp.json (Servers)
            </button>
            <button
              onClick={() => setActiveTab("app")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "app"
                  ? "bg-[var(--color-bg-interactive)] text-[var(--color-fg-interactive)] border border-[var(--color-border-interactive)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <Shield className="w-4 h-4" />
              app.yaml (Access)
            </button>
          </div>

          {/* Tab Content */}
          <div className="space-y-4">
            <div className="flex gap-4 mb-4">
              <Button
                variant="outline"
                onClick={() => copyExampleToTextarea(activeTab)}
                className="border-[var(--color-border-interactive)] text-[var(--color-fg-interactive)] hover:bg-[var(--color-bg-interactive-hover)]"
              >
                <Copy className="w-4 h-4 mr-2" />
                Use Example {activeTab === "mcp" ? "JSON" : "YAML"}
              </Button>

              <div className="relative">
                <Input
                  type="file"
                  accept={activeTab === "mcp" ? ".json" : ".yaml,.yml"}
                  onChange={(e) => handleFileUpload(e, activeTab)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Button
                  variant="outline"
                  className="border-[var(--color-border-interactive)] text-[var(--color-fg-interactive)] hover:bg-[var(--color-bg-interactive-hover)]"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload {activeTab === "mcp" ? "JSON" : "YAML"} File
                </Button>
              </div>
            </div>

            <div className="h-96 border border-[var(--color-border-interactive)] rounded-lg overflow-hidden">
              {activeTab === "mcp" ? (
                <Textarea
                  value={mcpConfigText}
                  onChange={(e) => {
                    setMcpConfigText(e.target.value);
                    setError(null);
                  }}
                  className="h-full font-mono text-sm resize-none border-0 focus:ring-0 bg-[var(--color-bg-container-overlay)] text-[var(--color-text-primary)] p-4"
                  placeholder="Paste your MCP servers configuration JSON here..."
                />
              ) : (
                <Textarea
                  value={appConfigText}
                  onChange={(e) => {
                    setAppConfigText(e.target.value);
                    setError(null);
                  }}
                  className="h-full font-mono text-sm resize-none border-0 focus:ring-0 bg-[var(--color-bg-container-overlay)] text-[var(--color-text-primary)] p-4"
                  placeholder="Paste your access control configuration YAML here..."
                />
              )}
            </div>

            <div className="p-4 bg-[var(--color-bg-info)] rounded-lg border border-[var(--color-border-info)]">
              <h4 className="font-medium text-[var(--color-text-primary)] mb-2">
                {activeTab === "mcp"
                  ? "MCP Configuration Guidelines:"
                  : "App Configuration Guidelines:"}
              </h4>
              <ul className="text-sm text-[var(--color-text-secondary)] space-y-1">
                {activeTab === "mcp" ? (
                  <>
                    <li>• Use valid JSON format</li>
                    <li>
                      • Include "targetServers" array with server definitions
                    </li>
                    <li>
                      • Include "connectedClients" array with client information
                    </li>
                    <li>
                      • Each server should have tools with usage statistics
                    </li>
                  </>
                ) : (
                  <>
                    <li>• Use valid YAML format</li>
                    <li>• Configure access controls and authentication</li>
                    <li>• Set rate limiting and authorization policies</li>
                    <li>• Define server and timeout settings</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-3 p-6 border-t border-[var(--color-border-primary)]">
          {onClose && (
            <Button
              variant="outline"
              onClick={onClose}
              className="border-[var(--color-border-interactive)] text-[var(--color-fg-interactive)] hover:bg-[var(--color-bg-interactive-hover)]"
            >
              Cancel
            </Button>
          )}
          <Button
            onClick={handleImport}
            disabled={isValidating || !mcpConfigText.trim()}
            className="bg-[var(--color-fg-interactive)] hover:bg-[var(--color-fg-interactive-hover)] text-[var(--color-text-primary-inverted)]"
          >
            {isValidating ? "Importing..." : "Import Configuration"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
