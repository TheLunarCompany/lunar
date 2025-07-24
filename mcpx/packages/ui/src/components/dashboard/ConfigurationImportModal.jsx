import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toMcpJsonFormat } from "@/utils";
import isEmpty from "lodash/isEmpty";
import { AlertCircle, FileText, Server, Shield, Upload } from "lucide-react";
import { useRef, useState } from "react";

export default function ConfigurationImportModal({
  currentAppConfigYaml = "",
  currentMcpConfig = null,
  isOpen,
  onClose,
  onConfigurationImport,
}) {
  const [activeTab, setActiveTab] = useState("app");
  const [mcpConfigText, setMcpConfigText] = useState(
    JSON.stringify(toMcpJsonFormat(currentMcpConfig.targetServers), null, 2) ||
      "",
  );
  const [appConfigText, setAppConfigText] = useState(
    currentAppConfigYaml || "",
  );
  const [error, setError] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleImport = async () => {
    setIsUpdating(true);
    setError(null);

    try {
      await onConfigurationImport({
        appConfig: { yaml: appConfigText },
      });
    } catch (e) {
      console.error("Configuration import failed:", e.message);
      setError("Failed to import configuration. Please try again.");
      setErrorDetails(
        JSON.stringify(
          e.response?.data?.errors?.length
            ? e.response?.data?.errors
            : !isEmpty(e.response?.data?.properties)
              ? e.response?.data?.properties
              : e.message,
          null,
          2,
        ),
      );
    }

    setIsUpdating(false);
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

  const inputRef = useRef(null);

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
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <details>
                  <pre>{errorDetails}</pre>
                </details>
              </AlertDescription>
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
              {activeTab === "app" && (
                <Input
                  type="file"
                  accept={activeTab === "mcp" ? ".json" : ".yaml,.yml"}
                  onChange={(e) => handleFileUpload(e, activeTab)}
                  className="hidden"
                  ref={inputRef}
                  hidden
                />
              )}
              <Button
                disabled={isUpdating || activeTab === "mcp"}
                variant="outline"
                className={cn(
                  "relative border-[var(--color-border-interactive)] text-[var(--color-fg-interactive)] hover:bg-[var(--color-bg-interactive-hover)] cursor-pointer",
                  {
                    "cursor-not-allowed": activeTab === "mcp",
                  },
                )}
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload {activeTab === "mcp" ? "JSON" : "YAML"} File
              </Button>
            </div>

            <div className="h-96 border border-[var(--color-border-interactive)] rounded-lg overflow-hidden">
              {activeTab === "mcp" ? (
                <Textarea
                  disabled
                  title="Not editable... for now"
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
            disabled={isUpdating || !mcpConfigText.trim()}
            className="bg-[var(--color-fg-interactive)] hover:enabled:bg-[var(--color-fg-interactive-hover)] text-[var(--color-text-primary-inverted)]"
          >
            {isUpdating ? (
              <>
                Updating...
                <Spinner />
              </>
            ) : (
              "Update Configuration"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
