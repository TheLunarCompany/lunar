import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { JsonSchemaType } from "@/utils/jsonUtils";
import { ExtensionDescription } from "@mcpx/shared-model";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

type ProviderLike = {
  name: string;
  originalTools: Array<{
    name: string;
    description?: string | { text: string; action: "append" | "rewrite" };
    inputSchema?: Tool["inputSchema"];
  }>;
  tools?: unknown[];
  icon?: string;
};
import { useCallback, useEffect, useMemo, useState } from "react";
import McpIcon from "../dashboard/SystemConnectivity/nodes/Mcpx_Icon.svg?react";
import HierarchyBadge from "@/components/HierarchyBadge";
import { useDomainIcon } from "@/hooks/useDomainIcon";

interface CustomToolDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  providers: ProviderLike[];
  onClose: () => void;
  onCreate: (toolData: {
    server: string;
    tool: string;
    name: string;
    originalName?: string;
    description: string;
    parameters: Array<{ name: string; description: string; value: string }>;
  }) => void;
  preSelectedServer?: string;
  preSelectedTool?: string;
  preFilledData?: {
    name: string;
    description: string | ExtensionDescription;
    parameters: Array<{ name: string; description: string; value: string }>;
  };
  editDialogMode?: "edit" | "duplicate" | "customize";
  isLoading?: boolean;
}

export function CustomToolDialog({
  isOpen,
  onOpenChange,
  providers,
  onClose,
  onCreate,
  preSelectedServer,
  preSelectedTool,
  preFilledData,
  editDialogMode,
  isLoading = false,
}: CustomToolDialogProps) {
  const [selectedServer, setSelectedServer] = useState("");
  const [selectedTool, setSelectedTool] = useState("");
  const [toolName, setToolName] = useState("");
  const [toolDescription, setToolDescription] = useState("");
  const [toolParameters, setToolParameters] = useState<
    Array<{ name: string; description: string; value: string; type?: string }>
  >([]);
  const [, setParameterActions] = useState<
    Record<number, "rewrite" | "append">
  >({});
  const [, setToolDescriptionAction] = useState<"rewrite" | "append">(
    "rewrite",
  );
  const [, setNameError] = useState<string>("");
  const [, setShowRenameWarning] = useState(false);
  const [nameErrorInline, setNameErrorInline] = useState<string | null>(null);
  const [nameTouched, setNameTouched] = useState(false);
  const [originalName, setOriginalName] = useState<string | undefined>(
    undefined,
  );
  const isCustomTool = editDialogMode === "edit";

  // Inline editing functions for name
  const validateToolNameInline = useCallback(
    (name: string): { isValid: boolean; error?: string } => {
      const trimmedName = name.trim();

      if (!trimmedName) {
        return { isValid: false, error: "Tool name is required" };
      }

      const allowed = /^[A-Za-z0-9_-]+$/;
      if (!allowed.test(trimmedName)) {
        return {
          isValid: false,
          error:
            "Only letters, digits, dash (-) and underscore (_) are allowed",
        };
      }

      if (selectedServer) {
        const server = providers.find((p) => p.name === selectedServer);
        if (server) {
          const originalToolExists = server.originalTools.some(
            (tool: { name: string }) => tool.name.trim() === trimmedName,
          );

          if (
            originalToolExists &&
            (!isCustomTool || preFilledData?.name !== trimmedName)
          ) {
            return {
              isValid: false,
              error: `This name already exists. please enter a different name`,
            };
          }

          const customToolExists = server.tools?.some((tool) => {
            const t = tool as { name?: string };
            return (
              t.name === trimmedName &&
              t.name?.toLowerCase() !== (originalName || "").toLowerCase()
            );
          });

          if (customToolExists) {
            return {
              isValid: false,
              error: `This name already exists. please enter a different name`,
            };
          }
        }
      }

      return { isValid: true };
    },
    [
      isCustomTool,
      originalName,
      preFilledData?.name,
      providers,
      selectedServer,
    ],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setNameError("");
    setShowRenameWarning(false);

    if (preSelectedServer && preSelectedTool) {
      setSelectedServer(preSelectedServer);
      setSelectedTool(preSelectedTool);

      if (preFilledData) {
        setToolName(preFilledData.name);
        setNameErrorInline(null);
        setNameTouched(false);
        const descriptionText =
          typeof preFilledData.description === "string"
            ? preFilledData.description
            : preFilledData.description?.text || "";
        setToolDescription(descriptionText);
        setToolParameters(preFilledData.parameters);
        setOriginalName(preFilledData.name);
      } else {
        const provider = providers.find((p) => p.name === preSelectedServer);
        const tool = provider?.originalTools.find(
          (t) => t.name === preSelectedTool,
        );

        const autoName = `Custom_${preSelectedTool}`;
        setToolName(autoName);
        const validation = validateToolNameInline(autoName);
        setNameErrorInline(
          validation.isValid ? null : validation.error || "Invalid tool name",
        );
        setNameTouched(false);
        const desc = tool?.description;
        setToolDescription(typeof desc === "string" ? desc : desc?.text || "");

        const parameters: Array<{
          name: string;
          description: string;
          value: string;
          type?: string;
        }> = [];
        if (tool?.inputSchema?.properties) {
          Object.entries(tool.inputSchema.properties).forEach(
            ([paramName, paramSchema]) => {
              const schema = paramSchema as JsonSchemaType;
              parameters.push({
                name: paramName,
                description: schema.description || "",
                value: String(schema.default ?? ""),
                type: schema.type,
              });
            },
          );
        }
        setToolParameters(parameters);
      }
    } else {
      setSelectedServer("");
      setSelectedTool("");
      setToolName("");
      setNameErrorInline(null);
      setNameTouched(false);
      setToolDescription("");
      setToolParameters([]);
      setOriginalName(undefined);
    }
    setParameterActions({});
    setToolDescriptionAction("rewrite");
  }, [
    isOpen,
    preSelectedServer,
    preSelectedTool,
    preFilledData,
    providers,
    validateToolNameInline,
  ]);

  const handleParameterChange = (index: number, value: string) => {
    const newParams = [...toolParameters];
    newParams[index].value = value;
    setToolParameters(newParams);
  };

  const handleParameterDescriptionChange = (
    index: number,
    description: string,
  ) => {
    const newParams = [...toolParameters];
    newParams[index].description = description;
    setToolParameters(newParams);
  };

  const handleCreate = () => {
    const validation = validateToolNameInline(toolName);
    if (!validation.isValid) {
      setNameErrorInline(validation.error!);
      setNameTouched(true);
      return;
    }

    onCreate({
      server: selectedServer,
      tool: selectedTool,
      name: toolName,
      originalName: originalName,
      description: toolDescription,
      parameters: toolParameters,
    });
  };

  const providerName = useMemo(
    () => selectedServer || preSelectedServer || "",
    [selectedServer, preSelectedServer],
  );
  const originToolName = useMemo(
    () => selectedTool || preSelectedTool || "",
    [selectedTool, preSelectedTool],
  );
  const providerIcon = useDomainIcon(providerName);
  const capitalizedProviderName = useMemo(() => {
    if (!providerName) return "";
    return providerName.charAt(0).toUpperCase() + providerName.slice(1);
  }, [providerName]);
  const providerIconColor = useMemo(() => {
    const provider = providers.find((p) => p.name === providerName);
    return provider?.icon;
  }, [providerName, providers]);

  return (
    <Dialog onOpenChange={onOpenChange} open={isOpen}>
      <DialogContent className="max-w-4xl rounded-lg p-0 overflow-hidden gap-0 [&>button]:hidden bg-white">
        <DialogTitle className="sr-only">Customize Tool</DialogTitle>
        <div className="px-6 py-6 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between bg-white">
            <div className="flex items-center gap-3 bg-white">
              <div className="flex flex-col">
                <h2 className="text-2xl font-semibold ">Customize Tool</h2>
              </div>
            </div>
            <DialogClose asChild>
              <button
                onClick={onClose}
                className="text-2xl leading-none text-gray-500 hover:text-gray-700 px-2 py-1"
                aria-label="Close"
              >
                ×
              </button>
            </DialogClose>
          </div>
        </div>
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Spinner size="large" />
              <span className="text-sm text-gray-600">
                Saving custom tool...
              </span>
            </div>
          </div>
        )}
        {/* Header */}
        <div className="  border-b border-gray-200 relative bg-white">
          <div className="mx-6 py-4 bg-white border-b border-gray-200 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3 ">
              {providerIcon ? (
                <img
                  src={providerIcon}
                  alt={`${providerName} icon`}
                  className="h-12 w-12 rounded-full object-contain bg-white"
                />
              ) : (
                <McpIcon
                  style={{ color: providerIconColor || "#4F33CC" }}
                  className="w-12 h-12"
                />
              )}
              <div className="flex flex-col">
                <h3 className="text-2xl font-semibold ">
                  {capitalizedProviderName}
                </h3>

                {isCustomTool ? (
                  <HierarchyBadge
                    serverName={originToolName || ""}
                    toolName={toolName || ""}
                  />
                ) : (
                  <span className="text-sm ">{selectedTool}</span>
                )}
              </div>
            </div>
          </div>

          <DialogDescription className="sr-only"></DialogDescription>

          <div className="px-6 bg-white">
            {/* Custom Tool Name */}
            <div className="mt-4">
              <h3 className="text-base font-medium text-gray-800 mb-1">
                Custom tool name
              </h3>
              <Input
                value={toolName}
                onChange={(e) => {
                  const value = e.target.value;
                  setToolName(value);
                  const result = validateToolNameInline(value);
                  setNameErrorInline(
                    result.isValid ? null : result.error || "Invalid tool name",
                  );
                }}
                onBlur={() => setNameTouched(true)}
                placeholder="Enter custom tool name"
                className={`w-full border-gray-200 focus-visible:ring-[#4F33CC] ${nameTouched && nameErrorInline ? "border-red-500" : ""}`}
              />
              {nameTouched && nameErrorInline && (
                <div className="flex pt-1 items-end gap-1">
                  <img
                    alt="Warning"
                    className="w-4 h-4"
                    src="/icons/warningCircle.png"
                  />
                  <p className=" text-xs text-[var(--color-fg-danger)]">
                    {nameErrorInline}
                  </p>
                </div>
              )}
            </div>

            {/* Description Section */}
            <div className="mt-4">
              <h3 className="text-base font-medium text-gray-800 mb-1">
                Description
              </h3>
              <Input
                value={toolDescription}
                onChange={(e) => setToolDescription(e.target.value)}
                placeholder="Enter tool description..."
                className="w-full border-gray-200 focus-visible:ring-[#4F33CC]"
              />
            </div>

            {/* Properties Section */}
            <div className="pb-6 ">
              <h3 className="text-base font-medium  my-4">Parameters</h3>
              <div className="space-y-4 max-h-80 overflow-y-auto rounded-lg pr-2">
                {toolParameters.length > 0 ? (
                  toolParameters.map((param, index) => (
                    <div
                      key={index}
                      className="border bg-[#F9F8FB] pb-4 border-gray-200 rounded-lg"
                    >
                      <div className="flex items-center justify-between px-4 py-3">
                        <div className="text-base font-semibold text-[#1D1B4B]">
                          {param.name}
                        </div>

                        <span className="text-[11px] rounded-sm font-medium text-[#1D1B4B] bg-[#E5E3EF] px-1 py-1">
                          {param.type || "string"}
                        </span>
                      </div>
                      <div className="relative px-4 pb-4 space-y-3">
                        <div className={param.type ? "pt-8" : "pt-0"}>
                          <label className="block text-xs font-medium mb-2">
                            Value
                          </label>
                          <Input
                            value={param.value}
                            onChange={(e) =>
                              handleParameterChange(index, e.target.value)
                            }
                            placeholder="Enter value"
                            className="w-full border-gray-200 focus-visible:ring-[#4F33CC]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium  mb-2">
                            Description
                          </label>
                          <Input
                            value={param.description}
                            onChange={(e) =>
                              handleParameterDescriptionChange(
                                index,
                                e.target.value,
                              )
                            }
                            placeholder="Enter parameter description"
                            className="w-full border-gray-200 focus-visible:ring-[#4F33CC]"
                          />
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-gray-500 italic">
                    No parameters found for this tool.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Dialog Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-white flex flex-row items-center justify-between">
          {/* <Button  onClick={onClose}  className="text-[#5147E4] bg-white   px-4 py-2 rounded-lg font-medium transition-colors text-sm ">
            Cancel
          </Button> */}
          <div
            onClick={onClose}
            className="text-[#5147E4] px-4 py-2 rounded-lg font-medium  text-sm cursor-pointer "
          >
            Cancel
          </div>
          <Button
            onClick={handleCreate}
            disabled={isLoading}
            className="text-white px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <Spinner size="small" className="text-white" />
                <span>Saving...</span>
              </div>
            ) : preSelectedServer && preSelectedTool && preFilledData ? (
              "Save"
            ) : (
              "Create"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
