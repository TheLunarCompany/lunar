import * as React from "react";
import { cn } from "@/lib/utils";
import { editor } from "monaco-editor";
import { FileText, Plus, Trash2 } from "lucide-react";
import { JSONSchema } from "zod/v4/core";
import { Button } from "./button";
import { CustomMonacoEditor } from "./custom-monaco-editor";
import ServerIconSvg from "@/icons/server_icon.svg?react";

export interface JsonUploadProps {
  value?: string;
  onChange?: (value: string) => void;
  onValidate?: (markers: editor.IMarker[]) => void;
  onFileUpload?: () => void;
  colorScheme?: "dark" | "light";
  className?: string;
  height?: string;
  schema?: JSONSchema.BaseSchema;
  placeholder?: string;
  /** When true, the editor fills all available vertical space (no fixed height, no outer scroll). */
  fillHeight?: boolean;
}

export const JsonUpload = ({
  value = "",
  onChange,
  onValidate,
  onFileUpload,
  className,
  height = "500px",
  schema,
  placeholder,
  fillHeight,
}: JsonUploadProps) => {
  const [isDragging, setIsDragging] = React.useState(false);
  const [uploadedContent, setUploadedContent] = React.useState<string>(
    value || "{}",
  );
  const [hasBeenUploaded, setHasBeenUploaded] = React.useState(!!value);
  const [uploadedFileName, setUploadedFileName] = React.useState<string | null>(
    null,
  );
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const valueRef = React.useRef(uploadedContent);
  const onValidateRef = React.useRef(onValidate);

  // Keep ref in sync with latest onValidate callback
  React.useEffect(() => {
    onValidateRef.current = onValidate;
  }, [onValidate]);

  React.useEffect(() => {
    if (value !== undefined) {
      const newValue = value || "{}";
      setUploadedContent(newValue);
      valueRef.current = newValue;
      if (value) {
        setHasBeenUploaded(true);
      }
      // Call onValidate with empty markers for initial value
      onValidateRef.current?.([]);
    }
  }, [value]);

  const handleFileRead = React.useCallback(
    (fileContent: string) => {
      try {
        // Try to parse JSON to validate it
        const parsed = JSON.parse(fileContent);
        const formatted = JSON.stringify(parsed, null, 2);
        setUploadedContent(formatted);
        setHasBeenUploaded(true);
        onChange?.(formatted);
        onFileUpload?.();
        // Call onValidate with empty markers since JSON is valid
        onValidate?.([]);
      } catch (error) {
        console.error("Invalid JSON file:", error);
        // Still set the content even if invalid, Monaco editor will show errors
        setUploadedContent(fileContent);
        setHasBeenUploaded(true);
        onChange?.(fileContent);
        onFileUpload?.();
        // Call onValidate with empty markers - Monaco will override with error markers if invalid
        onValidate?.([]);
      }
    },
    [onChange, onValidate, onFileUpload],
  );

  const handleFile = React.useCallback(
    (file: File) => {
      setUploadedFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (content) {
          handleFileRead(content);
        }
      };
      reader.onerror = () => {
        console.error("Error reading file");
      };
      reader.readAsText(file);
    },
    [handleFileRead],
  );

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        if (file.type === "application/json" || file.name.endsWith(".json")) {
          handleFile(file);
        }
      }
    },
    [handleFile],
  );

  const handleFileInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        const file = files[0];
        handleFile(file);
      }
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [handleFile],
  );

  const handleButtonClick = React.useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleValueChange = React.useCallback(
    (v?: string) => {
      const newValue = v || "{}";
      valueRef.current = newValue;
      setUploadedContent(newValue);
      onChange?.(newValue);
    },
    [onChange],
  );

  const handleValidate = React.useCallback(
    (markers: editor.IMarker[]) => {
      onValidate?.(markers);
    },
    [onValidate],
  );

  const handleDelete = React.useCallback(() => {
    setUploadedFileName(null);
    setUploadedContent("");
    setHasBeenUploaded(false);
    valueRef.current = "";
    onChange?.("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [onChange]);

  if (hasBeenUploaded || (value && value.trim() !== "")) {
    return (
      <div
        className={cn(
          "w-full flex flex-col gap-4",
          fillHeight && "flex-1 min-h-0",
          className,
        )}
      >
        {uploadedFileName && (
          <div className="flex flex-shrink-0 items-center justify-between px-3 py-2 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-900">{uploadedFileName}</span>
            </div>
            <button
              type="button"
              onClick={handleDelete}
              className="flex items-center justify-center p-1 rounded hover:bg-gray-100 transition-colors"
              aria-label="Delete file"
            >
              <Trash2 className="w-4 h-4 text-gray-500 hover:text-gray-900" />
            </button>
          </div>
        )}
        <div
          className={cn(
            "flex gap-4 items-start p-1",
            fillHeight && "flex-1 min-h-0",
            {
              "opacity-50": placeholder && uploadedContent === placeholder,
            },
          )}
        >
          <CustomMonacoEditor
            value={uploadedContent}
            onChange={handleValueChange}
            onValidate={handleValidate}
            height={fillHeight ? "100%" : height}
            language="json"
            schema={schema}
            className={fillHeight ? "flex-1 min-h-0" : ""}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-full rounded-lg",
        !hasBeenUploaded &&
          "border border-dashed border-[#5147E4] bg-[#F9FAFD]",
        "flex flex-col items-center justify-center",
        "transition-colors",
        fillHeight && "flex-1 min-h-0",
        isDragging && "border-dashed border-[#5147E4] bg-[#5147E4]/5",
        className,
      )}
      style={fillHeight ? undefined : { height }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFileInputChange}
        className="hidden"
      />
      <div className="flex flex-col items-center justify-center gap-2">
        <div className="flex flex-col items-center gap-2">
          <ServerIconSvg width="126.4px" height="200.003px" />
          <div className="flex items-center gap-2">
            <p className=" font-semibold text-[var(--color-text-primary)] text-[32px]">
              Add server
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="primary"
          size="lg"
          onClick={handleButtonClick}
          className="bg-[#5147E4] hover:bg-[#5147E4]/90 text-white w-[140px]"
        >
          <Plus className="w-6 h-6  font-bold" />
          Upload JSON
        </Button>
        <p className=" text-[var(--color-text-tertiary)]">or Drop it here</p>
      </div>
    </div>
  );
};
