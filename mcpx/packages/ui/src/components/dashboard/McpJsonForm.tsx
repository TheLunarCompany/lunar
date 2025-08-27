import { cn } from "@/lib/utils";
import MonacoEditor, { Theme as MonacoEditorTheme } from "@monaco-editor/react";
import { editor } from "monaco-editor";
import { useMemo, useRef, useState } from "react";
import { Label } from "../ui/label";

const MCP_JSON_FILE_PATH = "mcp.json";

export interface McpJsonFormProps {
  colorScheme?: "dark" | "light";
  errorMessage?: string;
  isDirty?: boolean;
  onChange: (value: string) => void;
  placeholder?: string;
  schema: any;
  value: string;
}

export const McpJsonForm = ({
  colorScheme = "light",
  errorMessage,
  isDirty,
  onChange,
  placeholder,
  schema,
  value,
}: McpJsonFormProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const monacoEditorTheme = useMemo<MonacoEditorTheme>(() => {
    return colorScheme === "dark" ? "vs-dark" : "light";
  }, [colorScheme]);

  return (
    <div className="w-full flex flex-col gap-4">
      <Label className="inline-flex flex-0 flex-col items-start mb-0">
        JSON
        <input
          className="absolute w-[0px] h-[0px] opacity-0"
          onFocus={() => editorRef.current?.focus()}
          readOnly
        />
      </Label>
      <div
        className={cn(
          "flex-1 gap-4 items-start border border-[var(--color-border-primary)] p-1 rounded-lg",
          {
            "opacity-50": placeholder && value === placeholder && !isFocused,
          },
        )}
      >
        <MonacoEditor
          height="304px"
          width={"100%"}
          defaultLanguage="json"
          language="json"
          value={value}
          onChange={(v) => onChange(v ?? "")}
          onMount={(editor, monaco) => {
            editorRef.current = editor;
            monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
              validate: true,
              schemas: [
                {
                  uri: "https://docs.lunar.dev/mcpx/mcp.json",
                  fileMatch: [MCP_JSON_FILE_PATH],
                  schema,
                },
              ],
              schemaValidation: "error",
            });
            editor.onDidFocusEditorText(() => {
              setIsFocused(true);
            });
            editor.onDidBlurEditorText(() => {
              setIsFocused(false);
            });
          }}
          options={{
            language: "json",
            autoClosingBrackets: "always",
            autoClosingQuotes: "always",
            autoIndent: "full",
            minimap: { enabled: false },
            formatOnPaste: true,
            formatOnType: true,
            quickSuggestions: {
              comments: false,
              other: true,
              strings: true,
            },
            scrollBeyondLastLine: false,
            suggest: {
              preview: true,
            },
          }}
          theme={monacoEditorTheme}
          path={MCP_JSON_FILE_PATH}
        />
      </div>
      {errorMessage && (
        <div className="mb-3 p-2 bg-[var(--color-bg-danger)] border border-[var(--color-border-danger)] rounded-md">
          <p className="inline-flex items-center gap-1 px-2 py-0.5 font-medium text-sm text-[var(--color-fg-danger)]">
            {errorMessage}
          </p>
        </div>
      )}
    </div>
  );
};
