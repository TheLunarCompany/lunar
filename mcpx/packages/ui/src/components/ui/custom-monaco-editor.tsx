import React, { useRef, useEffect } from "react";
import MonacoEditor from "@monaco-editor/react";
import { editor } from "monaco-editor";
import { JSONSchema } from "zod/v4/core";
import { highlightEnvKeys } from "@/components/dashboard/helpers";

interface CustomMonacoEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  height?: string;
  language?: string;
  placeholder?: string;
  className?: string;
  onValidate?: (markers: editor.IMarker[]) => void;
  schema?: JSONSchema.BaseSchema;
}

const MCP_JSON_FILE_PATH =
  import.meta.env.VITE_MCP_JSON_FILE_PATH || "file:///mcp.json";

export const CustomMonacoEditor: React.FC<CustomMonacoEditorProps> = ({
  value = "",
  onChange,
  height = "400px",
  language = "json",
  className = "",
  onValidate,
  schema,
}) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const valueRef = useRef(value);

  const handleValueChange = (newValue: string | undefined) => {
    const val = newValue || "";
    valueRef.current = val;
    onChange?.(val);
  };

  const handleValidate = (markers: editor.IMarker[]) => {
    onValidate?.(markers);
  };

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

  const handleExoticFormat = (value: string) => {
    const transformed = transformExoticFormat(value);
    editorRef.current?.setValue(transformed);
    handleValueChange(transformed);
  };

  // Cleanup editor on unmount to prevent errors when navigating away
  useEffect(() => {
    return () => {
      if (editorRef.current) {
        try {
          editorRef.current.dispose();
        } catch (error) {
          // Silently handle disposal errors - editor may already be disposed
          console.debug("Monaco editor disposal:", error);
        }
        editorRef.current = null;
      }
    };
  }, []);

  const monacoEditorTheme = "vs";

  return (
    <div className={`monaco-editor-container ${className}`}>
      <MonacoEditor
        height={height}
        width={"100%"}
        defaultLanguage={language}
        language={language}
        value={value}
        onChange={handleValueChange}
        onValidate={handleValidate}
        className="monaco-bg-light-blue"
        onMount={(
          editor: editor.IStandaloneCodeEditor,
          monaco: typeof import("monaco-editor"),
        ) => {
          editorRef.current = editor;

          const model = editor.getModel();

          let oldDecorationIds: string[] = [];

          const updateDecorations = () => {
            if (!model) return;

            model.deltaDecorations(oldDecorationIds, []);

            const newDecorations = highlightEnvKeys(model, monaco);

            oldDecorationIds = model.deltaDecorations([], newDecorations);
          };

          if (model) {
            updateDecorations();
            editor.onDidChangeModelContent(updateDecorations);
          }

          // `as any` required: monaco-editor's TypeScript definitions don't include
          // `languages.json.jsonDefaults` despite the API existing at runtime.
          // This is a known gap in @monaco-editor/react types.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (monaco.languages.json as any).jsonDefaults.setDiagnosticsOptions({
            validate: true,
            schemas: schema
              ? [
                  {
                    uri: "https://docs.lunar.dev/mcpx/mcp.json",
                    fileMatch: [MCP_JSON_FILE_PATH],
                    schema,
                  },
                ]
              : [],
            schemaValidation: "error",
          });

          editor.onDidPaste(() => {
            if (isExoticFormat(valueRef.current)) {
              handleExoticFormat(valueRef.current);
            }
          });
        }}
        options={{
          language,
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
  );
};
