import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useState, useEffect, useMemo } from "react";
import { ToolsItem } from "@/types";
import { useAccessControlsStore } from "@/store";
import { Server, Wrench, Check, X, Edit, Copy, Save } from "lucide-react";
import EditableBadge from "@/components/EditableBadge";
// @ts-ignore - SVG import issue
import McpIcon from "../dashboard/SystemConnectivity/nodes/Mcpx_Icon.svg?react";
import HierarchyBadge, { HierarchyItem } from "@/components/HierarchyBadge";
import CustomBadge from "../CustomBadge";
import { useDomainIcon } from "@/hooks/useDomainIcon";
import React from "react";

interface CustomToolDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  providers: any[];
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
    description: string;
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


  const { toolGroups } = useAccessControlsStore((s) => ({
    toolGroups: s.toolGroups,
  }));

  const [selectedServer, setSelectedServer] = useState("");
  const [selectedTool, setSelectedTool] = useState("");
  const [toolName, setToolName] = useState("");
  const [toolDescription, setToolDescription] = useState("");
  const [toolParameters, setToolParameters] = useState<
    Array<{ name: string; description: string; value: string; type?: string }>
  >([]);
  const [parameterActions, setParameterActions] = useState<
    Record<number, "rewrite" | "append">
  >({});
  const [toolDescriptionAction, setToolDescriptionAction] = useState<
    "rewrite" | "append"
  >("rewrite");
  const [nameError, setNameError] = useState<string>("");
  const [showRenameWarning, setShowRenameWarning] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [nameErrorInline, setNameErrorInline] = useState<string | null>(null);
  const [nameTouched, setNameTouched] = useState(false);
  const [originalName, setOriginalName] = useState<string | undefined>(undefined);

  // Check if a tool is referenced in any tool groups
  const isToolReferencedInGroups = (serverName: string, toolName: string) => {
    return toolGroups.some((group) => {
      const groupTools = group.services[serverName] || [];
      return groupTools.includes(toolName);
    });
  };

  const isCustomTool = editDialogMode === "edit";

  useEffect(() => {
    if (isOpen) {
      setNameError("");
      setShowRenameWarning(false);

      if (preSelectedServer && preSelectedTool) {
        // Prefill for both edit (custom tool) and customize (origin tool)
        setSelectedServer(preSelectedServer);
        setSelectedTool(preSelectedTool);

        if (preFilledData) {
          // Editing existing custom tool
          setToolName(preFilledData.name);
          setNameErrorInline(null);
          setNameTouched(false);
          // Handle description that can be either string or { text, action } object
          const descriptionText = typeof preFilledData.description === 'string'
            ? preFilledData.description
            : (preFilledData.description as any)?.text || '';
          setToolDescription(descriptionText);
          setToolParameters(preFilledData.parameters);
          setOriginalName(preFilledData.name); // Store original name for editing
        } else {
          // Customizing an original tool → create a new custom tool
          const provider = providers.find((p) => p.name === preSelectedServer);
          const tool = provider?.originalTools.find(
            (t: any) => t.name === preSelectedTool,
          );

          const autoName = `Custom_${preSelectedTool}`;
          setToolName(autoName);
          const validation = validateToolNameInline(autoName);
          setNameErrorInline(validation.isValid ? null : validation.error || "Invalid tool name");
          setNameTouched(false);
          setToolDescription(tool?.description || "");

          const parameters: Array<{
            name: string;
            description: string;
            value: string;
            type?: string;
          }> = [];
          if (tool?.inputSchema?.properties) {
            Object.entries(tool.inputSchema.properties).forEach(
              ([paramName, paramSchema]: [string, any]) => {
                parameters.push({
                  name: paramName,
                  description: (paramSchema as any).description || "",
                  value: (paramSchema as any).default || "",
                  type: (paramSchema as any).type,
                });
              },
            );
          }
          setToolParameters(parameters);
        }
      } else {
        // Fresh create without pre-selected context
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
    }
  }, [isOpen, preSelectedServer, preSelectedTool, preFilledData]);

  const handleServerChange = (serverName: string) => {
    setSelectedServer(serverName);
    setSelectedTool("");
    setToolName("");
    setToolDescription("");
    setToolParameters([]);
    setParameterActions({});
    setNameError("");
    setNameTouched(false);
    setNameErrorInline(null);
  };

  const handleToolChange = (toolName: string) => {
    setSelectedTool(toolName);
    setNameError("");

    if (selectedServer && toolName) {
      const provider = providers.find((p) => p.name === selectedServer);
      const tool = provider?.originalTools.find(
        (t: any) => t.name === toolName,
      );

      if (tool) {
        const autoName = `Custom_${tool.name}`;
        setToolName(autoName);
        const validation = validateToolNameInline(autoName);
        setNameErrorInline(validation.isValid ? null : validation.error || "Invalid tool name");
        setNameTouched(false);
        setToolDescription(tool.description || "");

        const parameters: Array<{
          name: string;
          description: string;
          value: string;
          type?: string;
        }> = [];
        if (tool.inputSchema && tool.inputSchema.properties) {
          Object.entries(tool.inputSchema.properties).forEach(
            ([paramName, paramSchema]: [string, any]) => {
              parameters.push({
                name: paramName,
                description: paramSchema.description || "",
                value: paramSchema.default || "",
                type: paramSchema.type,
              });
            },
          );
        }
        setToolParameters(parameters);
      }
    }
  };

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

  const handleParameterActionChange = (
    index: number,
    action: "rewrite" | "append",
  ) => {
    setParameterActions((prev) => ({
      ...prev,
      [index]: action,
    }));
  };


  // Inline editing functions for name
  const validateToolNameInline = (name: string): { isValid: boolean; error?: string } => {

    const trimmedName = name.trim();

    if (!trimmedName) {
      return { isValid: false, error: "Tool name is required" };
    }
  
    const allowed = /^[A-Za-z0-9_-]+$/;
    if (!allowed.test(trimmedName)) {
      return {
        isValid: false,
        error: "Only letters, digits, dash (-) and underscore (_) are allowed",
      };
    }

    // Check for duplicate names
    if (selectedServer) {
      const server = providers.find((p) => p.name === selectedServer);

      console.log("SERVER" , server)
      if (server) {
        const originalToolExists = server.originalTools.some(
          (tool: any) => tool.name.trim() === trimmedName,
        );
        isCustomTool
        console.log("SERVER" , originalToolExists && (!isCustomTool || preFilledData?.name !== trimmedName) )
        if (originalToolExists && (!isCustomTool || preFilledData?.name !== trimmedName) ) {
          return {
            isValid: false,
            error: `This name already exists. please enter a different name`,
          };
        }

        const customToolExists = server.tools?.some(
          (tool: ToolsItem) =>
            tool.name === trimmedName &&
            tool.name.toLowerCase() !== (originalName || "").toLowerCase(),
        );

        if (customToolExists) {
          return {
            isValid: false,
            error: `This name already exists. please enter a different name`,
          };
        }
      }
    }

    return { isValid: true };
  };

  const handleStartEditName = () => {
    setIsEditingName(true);
    setEditName(toolName);
    setNameErrorInline(null);
  };

  const handleSaveEditName = () => {
    const validation = validateToolNameInline(editName);
    if (!validation.isValid) {
      setNameErrorInline(validation.error!);
      return;
    }

    setToolName(editName.trim());
    setIsEditingName(false);
    setNameErrorInline(null);
  };

  const handleCancelEditName = () => {
    setIsEditingName(false);
    setEditName(toolName);
    setNameErrorInline(null);
  };

  const handleKeyDownName = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSaveEditName();
    } else if (e.key === "Escape") {
      handleCancelEditName();
    }
  };

  const handleCreate = () => {
    console.log("[CustomToolDialog] handleCreate called");

    const validation = validateToolNameInline(toolName);
    if (!validation.isValid) {
      setNameErrorInline(validation.error!);
      setNameTouched(true)
      return;
    }

    console.log("[CustomToolDialog] calling onCreate with:", {
      server: selectedServer,
      tool: selectedTool,
      name: toolName,
      originalName: originalName,
      description: toolDescription,
      parameters: toolParameters,
    });

    onCreate({
      server: selectedServer,
      tool: selectedTool,
      name: toolName,
      // If tool is custom (originalName exists), we edit the existing one (use original name)
      // If tool is origin (originalName is undefined), we create a new custom tool
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
  const displayLabel = providerName && originToolName
    ? `${providerName} → ${originToolName}`
    : originToolName || providerName || "Tool";

  return (
    <Dialog onOpenChange={onOpenChange} open={isOpen}>
      <DialogContent className="max-w-4xl rounded-lg p-0 overflow-hidden gap-0 [&>button]:hidden bg-white">
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
                <McpIcon style={{ color: providerIconColor || "#4F33CC" }} className="w-12 h-12" />
              )}
              <div className="flex flex-col">
                <h3 className="text-2xl font-semibold ">{capitalizedProviderName}</h3>
              
              {isCustomTool ? (<HierarchyBadge
                    serverName={originToolName || ""}
                    toolName={toolName || ""}
                  />) : (    <span className="text-sm ">{selectedTool}</span>)  }  
            
              </div>
            </div>






            </div>






          <DialogDescription className="sr-only">

          </DialogDescription>

<div className="px-6 bg-white">
          {/* Custom Tool Name */}
          <div className="mt-4">
            <h3 className="text-base font-medium text-gray-800 mb-1">Custom tool name</h3>
            <Input
              value={toolName}
              onChange={(e) => {
                const value = e.target.value;
                setToolName(value);
                const result = validateToolNameInline(value);
                setNameErrorInline(result.isValid ? null : result.error || "Invalid tool name");
              }}
              onBlur={() => setNameTouched(true)}
              placeholder="Enter custom tool name"
              className={`w-full border-gray-200 focus-visible:ring-[#4F33CC] ${nameTouched && nameErrorInline ? "border-red-500" : ""}`}
            />
            {nameTouched && nameErrorInline && (
              <div className="flex pt-1 items-end gap-1">
                <img  alt="Warning"
               className="w-4 h-4" src="/icons/warningCircle.png"/> 
              <p className=" text-xs text-[var(--color-fg-danger)]">         
             {nameErrorInline}</p>
              </div>
             
            )}
          </div>

          {/* Description Section */}
          <div className="mt-4">
            <h3 className="text-base font-medium text-gray-800 mb-1">Description</h3>
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
                  <div key={index} className="border bg-[#F9F8FB] pb-4 border-gray-200 rounded-lg">
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
          <div  onClick={onClose}  className="text-[#5147E4] px-4 py-2 rounded-lg font-medium  text-sm cursor-pointer ">
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
