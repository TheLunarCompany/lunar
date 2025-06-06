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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Save, AlertCircle, Code } from "lucide-react";

export default function ConfigurationModal({
  isOpen,
  onClose,
  configuration,
  onSave,
}) {
  // ... (keep existing state and logic) ...
  const [configText, setConfigText] = useState(
    JSON.stringify(
      configuration || {
        mcpServers: {
          sentry: {
            command: "npx",
            args: ["-y", "mcp-remote", "https://mcp.sentry.dev/sse"],
          },
        },
      },
      null,
      2,
    ),
  );
  const [error, setError] = useState(null);
  const [isValidating, setIsValidating] = useState(false);

  const validateJSON = (text) => {
    try {
      JSON.parse(text);
      return true;
    } catch (e) {
      return false;
    }
  };

  const handleSave = async () => {
    setIsValidating(true);
    setError(null);

    if (!validateJSON(configText)) {
      setError("Invalid JSON format. Please check your configuration.");
      setIsValidating(false);
      return;
    }

    try {
      const parsedConfig = JSON.parse(configText);
      await onSave(parsedConfig);
      onClose();
    } catch (e) {
      setError("Failed to save configuration. Please try again.");
    }

    setIsValidating(false);
  };

  const handleTextChange = (value) => {
    setConfigText(value);
    setError(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col bg-[var(--color-bg-container)] border border-[var(--color-border-primary)] rounded-lg">
        <DialogHeader className="border-b border-[var(--color-border-primary)] p-4">
          <DialogTitle className="flex items-center gap-2 text-xl text-[var(--color-text-primary)]">
            <Code className="w-6 h-6 text-[var(--color-fg-interactive)]" />
            MCPX Configuration Editor
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden p-4">
          {error && (
            <Alert
              variant="destructive"
              className="mb-4 bg-[var(--color-bg-danger)] border-[var(--color-border-danger)] text-[var(--color-fg-danger)]"
            >
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="h-96 border border-[var(--color-border-interactive)] rounded-lg overflow-hidden">
            <Textarea
              value={configText}
              onChange={(e) => handleTextChange(e.target.value)}
              className="h-full font-mono text-sm resize-none border-0 focus:ring-0 bg-[var(--color-bg-container-overlay)] text-[var(--color-text-primary)] p-2"
              placeholder="Enter your MCPX configuration..."
            />
          </div>

          <div className="mt-4 p-3 bg-[var(--color-bg-info)] rounded-lg border border-[var(--color-border-info)]">
            <h4 className="font-medium text-[var(--color-text-primary)] mb-2">
              Configuration Guidelines:
            </h4>
            <ul className="text-sm text-[var(--color-text-secondary)] space-y-1">
              <li>• Use valid JSON format</li>
              <li>• Define MCP servers under "mcpServers" key</li>
              <li>• Each server needs "command" and "args" properties</li>
              <li>• Changes will be applied immediately upon saving</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-3 p-4 border-t border-[var(--color-border-primary)]">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-[var(--color-border-interactive)] text-[var(--color-fg-interactive)] hover:bg-[var(--color-bg-interactive-hover)]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isValidating || !validateJSON(configText)}
            className="bg-[var(--color-fg-interactive)] hover:bg-[var(--color-fg-interactive-hover)] text-[var(--color-text-primary-inverted)]"
          >
            <Save className="w-4 h-4 mr-2" />
            {isValidating ? "Saving..." : "Save Configuration"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
