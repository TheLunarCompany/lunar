"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { appConfigSchema } from "@mcpx/shared-model";
import MonacoEditor, { Theme as MonacoEditorTheme } from "@monaco-editor/react";
import { FileText } from "lucide-react";
import { useMemo, useState } from "react";
import YAML from "yaml";

export default function ConfigurationModal({
  currentAppConfigYaml = "",
  isOpen,
  onClose,
  onConfigurationImport,
}: {
  currentAppConfigYaml?: string;
  isOpen: boolean;
  onClose?: () => void;
  onConfigurationImport: (config: {
    appConfig: { yaml: string };
  }) => Promise<void>;
}) {
  const [appConfigText, setAppConfigText] = useState(
    currentAppConfigYaml || "",
  );
  const isDirty = useMemo(
    () => appConfigText.trim() !== currentAppConfigYaml.trim(),
    [appConfigText, currentAppConfigYaml],
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const colorScheme = useColorScheme();
  const monacoEditorTheme = useMemo<MonacoEditorTheme>(() => {
    return colorScheme === "dark" ? "vs-dark" : "light";
  }, [colorScheme]);

  const [isValid, setIsValid] = useState(true);
  const { toast } = useToast();

  const handleUpdateClick = async () => {
    if (!isValid) {
      console.error("Configuration is not valid");
      return;
    }

    setIsUpdating(true);

    try {
      await onConfigurationImport({
        appConfig: { yaml: appConfigText },
      });
      toast({
        title: "Configuration Updated",
        description:
          "The configuration update has been successfully applied to your MCPX system.",
        duration: 5000,
      });
    } catch (e) {
      console.error(
        "Configuration import failed:",
        e instanceof Error ? e.message : e,
      );
      toast({
        title: "Configuration Update Failed",
        description:
          "There was an error applying your configuration. Please check the console for details.",
        variant: "destructive",
      });
    }

    setIsUpdating(false);
  };

  const handleYamlChange = (value: string | undefined) => {
    setAppConfigText(value || "");

    try {
      const parsedYaml = value ? YAML.parse(value) : null;
      appConfigSchema.parse(parsedYaml);
      setIsValid(true);
    } catch (e) {
      console.error("Failed to parse YAML", e);
      setIsValid(false);
      return;
    }
  };

  const handleClose = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (
      !isDirty ||
      confirm("Close Configuration? Changes you made have not been saved")
    ) {
      onClose?.();
    }
    e?.preventDefault();
    e?.stopPropagation();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col bg-[var(--color-bg-container)] border border-[var(--color-border-primary)] rounded-lg">
        <DialogHeader className="border-b border-[var(--color-border-primary)] p-6">
          <DialogTitle className="flex items-center gap-2 text-2xl text-[var(--color-text-primary)]">
            <FileText className="w-6 h-6 text-[var(--color-fg-interactive)]" />
            MCPX System Configuration
          </DialogTitle>
          <p className="text-[var(--color-text-secondary)] mt-2">
            Configure your MCPX system with custom tool extensions and access
            controls.
          </p>
        </DialogHeader>

        <div className="flex-1 p-6">
          <div className="space-y-4">
            <div className="h-96 border border-[var(--color-border-interactive)] rounded-lg">
              <MonacoEditor
                width={"100%"}
                defaultLanguage="yaml"
                language="yaml"
                defaultValue={currentAppConfigYaml}
                onChange={handleYamlChange}
                options={{
                  language: "yaml",
                  autoClosingBrackets: "always",
                  autoClosingQuotes: "always",
                  autoIndent: "full",
                  minimap: { enabled: false },
                  formatOnPaste: true,
                  formatOnType: true,
                  suggestOnTriggerCharacters: true,
                  quickSuggestions: {
                    comments: false,
                    other: true,
                    strings: true,
                  },
                }}
                theme={monacoEditorTheme}
                path="app.yaml"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-3 p-6 border-t border-[var(--color-border-primary)]">
          <Button
            variant="outline"
            onClick={handleClose}
            className="border-[var(--color-border-interactive)] text-[var(--color-fg-interactive)] hover:bg-[var(--color-bg-interactive-hover)]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpdateClick}
            disabled={
              isUpdating || !appConfigText.trim() || !isValid || !isDirty
            }
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
