import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useState, useEffect } from "react";
import { ToolsItem } from "@/types";
import { Switch } from "../ui/switch";
import { useAccessControlsStore } from "@/store";

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
    Array<{ name: string; description: string; value: string }>
  >([]);
  const [editHelperTexts, setEditHelperTexts] = useState(false);
  const [parameterActions, setParameterActions] = useState<
    Record<number, "rewrite" | "append">
  >({});
  const [toolDescriptionAction, setToolDescriptionAction] = useState<
    "rewrite" | "append"
  >("rewrite");
  const [nameError, setNameError] = useState<string>("");
  const [showRenameWarning, setShowRenameWarning] = useState(false);

  // Check if a tool is referenced in any tool groups
  const isToolReferencedInGroups = (serverName: string, toolName: string) => {
    return toolGroups.some((group) => {
      const groupTools = group.services[serverName] || [];
      return groupTools.includes(toolName);
    });
  };

  useEffect(() => {
    if (isOpen) {
      setNameError("");
      setShowRenameWarning(false);

      if (preSelectedServer && preSelectedTool && preFilledData) {
        setSelectedServer(preSelectedServer);
        setSelectedTool(preSelectedTool);
        setToolName(preFilledData.name);
        setToolDescription(preFilledData.description);
        setToolParameters(preFilledData.parameters);
      } else {
        setSelectedServer("");
        setSelectedTool("");
        setToolName("");
        setToolDescription("");
        setToolParameters([]);
      }
      setEditHelperTexts(false);
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
    setEditHelperTexts(false);
    setNameError("");
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
        setToolName(tool.name);
        setToolDescription(tool.description || "");

        const parameters: Array<{
          name: string;
          description: string;
          value: string;
        }> = [];
        if (tool.inputSchema && tool.inputSchema.properties) {
          Object.entries(tool.inputSchema.properties).forEach(
            ([paramName, paramSchema]: [string, any]) => {
              parameters.push({
                name: paramName,
                description: paramSchema.description || "",
                value: paramSchema.default || "",
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

  const validateToolName = (name: string) => {
    if (!name.trim()) {
      setNameError("Tool name is required");
      return false;
    }

    // Check name pattern - only allow letters, numbers, underscores, and hyphens
    const namePattern = /^[a-zA-Z0-9_-]+$/;
    if (!namePattern.test(name)) {
      setNameError("Tool name can only contain letters, numbers, dashes, and underscores");
      return false;
    }

    // Check for duplicate names in the same server
    if (selectedServer) {
      const provider = providers.find((p) => p.name === selectedServer);
      if (provider) {
        // Check original tools
        const originalToolExists = provider.originalTools.some(
          (tool: ToolsItem) => tool.name.toLowerCase() === name.toLowerCase(),
        );

        if (originalToolExists) {
          setNameError(
            `A tool named "${name}" already exists as an original tool in this server`,
          );
          return false;
        }
      }
    }

    setNameError("");
    return true;
  };

  const handleCreate = () => {
    if (!validateToolName(toolName)) {
      return;
    }

    onCreate({
      server: selectedServer,
      tool: selectedTool,
      name: toolName,
      originalName: preFilledData?.name,
      description: toolDescription,
      parameters: toolParameters,
    });
  };
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[90vw] max-w-5xl max-h-[90vh] flex flex-col p-0 relative !fixed !top-1/2 !left-1/2 !transform !-translate-x-1/2 !-translate-y-1/2 !z-[9999]"
        style={{ overflow: "visible" }}
      >
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
        <div className="mb-6 px-6 pt-6">
          <DialogTitle className="text-xl font-semibold text-gray-900">
            {preSelectedServer && preSelectedTool && preFilledData
              ? "Edit Custom Tool"
              : "Create Custom Tool"}
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm text-gray-600">
            {preSelectedServer && preSelectedTool && preFilledData
              ? "Modify the custom tool settings and parameters."
              : "Create a new custom tool by customizing an existing tool with your own parameters and descriptions."}
          </DialogDescription>
        </div>

        <div className="space-y-6 overflow-y-auto flex-1 px-6">
          {/* General Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              General
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Server*
                </label>
                {preSelectedServer ? (
                  <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-600">
                    {preSelectedServer}
                  </div>
                ) : (
                  <select
                    value={selectedServer}
                    onChange={(e) => handleServerChange(e.target.value)}
                    className="w-full px-3 py-2 border border-purple-200 rounded-lg bg-purple-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    style={{ zIndex: 1000 }}
                  >
                    <option value="">Select</option>
                    {providers.map((provider) => (
                      <option key={provider.name} value={provider.name}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tool*
                </label>
                {preSelectedTool ? (
                  <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-600">
                    {preSelectedTool}
                  </div>
                ) : (
                  <select
                    key={selectedServer}
                    value={selectedTool}
                    onChange={(e) => handleToolChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    disabled={!selectedServer}
                    style={{ zIndex: 1000 }}
                  >
                    <option value="">Select</option>
                    {selectedServer &&
                      providers
                        .find((p) => p.name === selectedServer)
                        ?.originalTools.map((tool: ToolsItem) => (
                          <option key={tool.name} value={tool.name}>
                            {tool.name}
                          </option>
                        ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* Show additional sections only after server and tool are selected or when pre-filled */}
          {((selectedServer && selectedTool) ||
            (preSelectedServer && preSelectedTool)) && (
            <>
              {/* Properties Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Properties
                </h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name (required)
                  </label>
                  <Input
                    value={toolName}
                    onChange={(e) => {
                      const newName = e.target.value;
                      setToolName(newName);
                      if (nameError) {
                        setNameError("");
                      }
                      
                      // Check if this is a rename operation and if the tool is referenced in groups
                      if (preFilledData?.name && newName !== preFilledData.name && selectedServer) {
                        const isReferenced = isToolReferencedInGroups(selectedServer, preFilledData.name);
                        setShowRenameWarning(isReferenced);
                      } else {
                        setShowRenameWarning(false);
                      }
                    }}
                    onBlur={() => validateToolName(toolName)}
                    placeholder="Enter tool name"
                    className={`w-full ${nameError ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}`}
                  />
                  {nameError && (
                    <p className="mt-1 text-sm text-red-600">{nameError}</p>
                  )}
                  {showRenameWarning && (
                    <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        <strong>Warning:</strong> This tool is currently used in one or more tool groups. 
                        Renaming it will affect all connected tool groups and may impact agents using this tool.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Tool Description Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Tool Description
                  </h3>
                  <div className="flex gap-1">
                    <Button
                    variant="secondary"
                      size="sm"
                      onClick={() => setToolDescriptionAction("rewrite")}
               
                    >
                      Rewrite
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setToolDescriptionAction("append")}
            
                    >
                      Append
                    </Button>
                  </div>
                </div>
                <textarea
                  value={toolDescription}
                  onChange={(e) => setToolDescription(e.target.value)}
                  className="w-full h-32 px-3 py-2 border bg-white border-purple-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Enter tool description..."
                />
              </div>

              {/* Parameters Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Parameters
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">
                      Edit parameters descriptions
                    </span>
                    <Switch
                      checked={editHelperTexts}
                      onCheckedChange={() => setEditHelperTexts(!editHelperTexts)}
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  {toolParameters.length > 0 ? (
                    toolParameters.map((param, index) => (
                      <div key={index} className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {param.name}
                          </label>
                          <Input
                            value={param.value}
                            onChange={(e) =>
                              handleParameterChange(index, e.target.value)
                            }
                            placeholder="Enter string value"
                            className="w-full border-purple-200"
                          />
                        </div>

                        {/* Parameter Description */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {param.name} Description
                          </label>
                          {editHelperTexts ? (
                            <div className="flex items-center gap-2">
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant={parameterActions[index] !== "append" ? "primary" : "secondary"}
                                  onClick={() =>
                                    handleParameterActionChange(
                                      index,
                                      "rewrite",
                                    )
                                  }
                                >
                                  Rewrite
                                </Button>
                                <Button
                                  size="sm"
                                  variant={parameterActions[index] === "append" ? "primary" : "secondary"}
                                  onClick={() =>
                                    handleParameterActionChange(index, "append")
                                  }
                                >
                                  Append
                                </Button>
                              </div>
                              <Input
                                value={param.description}
                                onChange={(e) =>
                                  handleParameterDescriptionChange(
                                    index,
                                    e.target.value,
                                  )
                                }
                                className="flex-1 border-purple-200"
                              />
                            </div>
                          ) : (
                            <p className="text-xs text-gray-500">
                              {param.description}
                            </p>
                          )}
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
            </>
          )}
        </div>

        {/* Dialog Footer */}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-gray-200 flex-shrink-0 px-6 pb-6">
          <Button variant="secondary" onClick={onClose} className="px-6 py-2">
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!selectedServer || !selectedTool || isLoading}
            className=" text-white px-6 py-2  disabled:opacity-50 disabled:cursor-not-allowed"
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
