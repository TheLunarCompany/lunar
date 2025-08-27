import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import MonacoEditor, { Theme as MonacoEditorTheme } from "@monaco-editor/react";
import { editor } from "monaco-editor";
import { useCallback, useMemo, useRef, useState } from "react";
import { JSONSchema } from "zod/v4/core";

const MCP_JSON_FILE_PATH = "mcp.json";

const isExoticFormat = (value: string = "") => {
  try {
    const parsed = JSON.parse(value);
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      ("mcpServers" in parsed || "servers" in parsed)
    );
  } catch {
    return false;
  }
};

const transformExoticFormat = (value: string = "") => {
  let exotic = null;
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null) return value;
    if ("mcpServers" in parsed) exotic = parsed["mcpServers"];
    else if ("servers" in parsed) exotic = parsed["servers"];
  } catch {
    return value;
  }

  return exotic ? JSON.stringify(exotic, null, 2) : value;
};

export interface McpJsonFormProps {
  colorScheme?: "dark" | "light";
  errorMessage?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  schema: JSONSchema.BaseSchema;
  value: string;
}

export const McpJsonForm = ({
  colorScheme = "light",
  errorMessage,
  onChange,
  placeholder,
  schema,
  value,
}: McpJsonFormProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const valueRef = useRef(value);

  const monacoEditorTheme = useMemo<MonacoEditorTheme>(() => {
    return colorScheme === "dark" ? "vs-dark" : "light";
  }, [colorScheme]);

  const handleValueChange = useCallback(
    (v?: string) => {
      valueRef.current = v || "";
      onChange(valueRef.current);
    },
    [onChange],
  );

  const handleExoticFormat = useCallback(
    (v: string) => {
      const transformed = transformExoticFormat(v);
      editorRef.current?.setValue(transformed);
      handleValueChange(transformed);
    },
    [handleValueChange],
  );

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
          onChange={handleValueChange}
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
            editor.onDidPaste(() => {
              if (isExoticFormat(valueRef.current)) {
                handleExoticFormat(valueRef.current);
              }
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
