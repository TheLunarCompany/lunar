import { cn } from "@/lib/utils";
import { editor } from "monaco-editor";
import { useCallback, useRef } from "react";
import { JSONSchema } from "zod/v4/core";
import { CustomMonacoEditor } from "@/components/ui/custom-monaco-editor";

export interface McpJsonFormProps {
  colorScheme?: "dark" | "light";
  errorMessage?: string;
  onChange: (value: string) => void;
  onValidate?: (markers: editor.IMarker[]) => void;
  placeholder?: string;
  className?: string;
  schema: JSONSchema.BaseSchema;
  value: string;
  /** When true, the editor fills all available vertical space (no fixed height, no outer scroll). */
  fillHeight?: boolean;
}

export const McpJsonForm = ({
  errorMessage,
  onChange,
  onValidate,
  schema,
  value,
  className,
  fillHeight,
}: McpJsonFormProps) => {
  const valueRef = useRef(value);

  const handleValueChange = useCallback(
    (v?: string) => {
      valueRef.current = v || "";
      onChange(valueRef.current);
    },
    [onChange],
  );

  const handleValidate = useCallback(
    (markers: editor.IMarker[]) => {
      onValidate?.(markers);
    },
    [onValidate],
  );

  return (
    <div
      className={cn(
        "w-full flex flex-col gap-4",
        fillHeight && "flex-1 min-h-0",
        className,
      )}
    >
      <CustomMonacoEditor
        value={value}
        onChange={handleValueChange}
        onValidate={handleValidate}
        height={fillHeight ? "100%" : "500px"}
        language="json"
        schema={schema}
        className={fillHeight ? "flex-1 min-h-0" : ""}
      />
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
