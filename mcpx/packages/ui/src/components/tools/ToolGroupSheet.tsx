import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Search, Edit, Trash2, Check, X } from "lucide-react";
import React, { useState, useEffect } from "react";
import McpIcon from "../dashboard/SystemConnectivity/nodes/Mcpx_Icon.svg?react";
import { RemoteTargetServer } from "mcpx-server/src/model/target-servers";
import { useDomainIcon } from "@/hooks/useDomainIcon";

interface ToolGroupSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedToolGroup: any;
  toolGroups: any[];
  providers: any[];
  onEditGroup?: (group: any) => void;
  onDeleteGroup?: (group: any) => void;
  onUpdateGroupName?: (groupId: string, newName: string) => void;
  onUpdateGroupDescription?: (groupId: string, description: string) => void;
}



function DomainIcon({ provider, size = 16 }: { provider: RemoteTargetServer; size?: number }) {
  const iconSrc = useDomainIcon(provider.name);

  let imageColor = "black";
  if (!iconSrc) {
    imageColor = provider.icon || imageColor;
  }

  return iconSrc ? (
    <img
      src={iconSrc}
      alt="favicon"
      className="object-contain"
      style={{ width: size, height: size }}
    />
  ) : (
    <McpIcon style={{ color: imageColor, width: size, height: size }} />
  );
}



export function ToolGroupSheet({
  isOpen,
  onOpenChange,
  selectedToolGroup,
  toolGroups,
  providers,
  onEditGroup,
  onDeleteGroup,
  onUpdateGroupName,
  onUpdateGroupDescription,
}: ToolGroupSheetProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [isSavingDescription, setIsSavingDescription] = useState(false);





  // Reset search when sheet is closed
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSearchQuery("");
      setIsEditingTitle(false);
      setEditTitle("");
      setTitleError(null);
      setDescription("");
    }
    onOpenChange(open);
  };

  // Initialize description when selectedToolGroup changes
  useEffect(() => {
    if (selectedToolGroup) {
      // Find the actual tool group from the toolGroups array to get the latest description
      const actualToolGroup = toolGroups.find(group => group.id === selectedToolGroup.id);
      setDescription(actualToolGroup?.description || "");
    }
  }, [selectedToolGroup, toolGroups]);

  const validateToolGroupName = (name: string): { isValid: boolean; error?: string } => {
    const trimmedName = name.trim();
    
    if (!trimmedName) {
      return { isValid: false, error: "Tool Group name is required" };
    }
    
    const allowed = /^[A-Za-z0-9_-]+$/;
    if (!allowed.test(trimmedName)) {
      return {
        isValid: false,
        error: "Only letters, digits, dash (-) and underscore (_) are allowed",
      };
    }

    // Check for duplicate names
    if (toolGroups.some((group) => group.name === trimmedName && group.id !== selectedToolGroup?.id)) {
      return {
        isValid: false,
        error: "A tool group with this name already exists. Please choose a different name.",
      };
    }

    return { isValid: true };
  };

  const handleStartEdit = () => {
    setEditTitle(selectedToolGroup?.name || "");
    setIsEditingTitle(true);
    setTitleError(null);
  };

  const handleSaveEdit = () => {
    const validation = validateToolGroupName(editTitle);
    if (!validation.isValid) {
      setTitleError(validation.error!);
      return;
    }

    if (editTitle.trim() && onUpdateGroupName) {
      onUpdateGroupName(selectedToolGroup.id, editTitle.trim());
      setIsEditingTitle(false);
      setEditTitle("");
      setTitleError(null);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingTitle(false);
    setEditTitle("");
    setTitleError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveEdit();
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[600px] !max-w-[600px] bg-white p-0 flex flex-col [&>button]:hidden"
      >
        <SheetHeader className="px-6">
          <div className="flex items-center justify-between mt-5 mb-2">
            {isEditingTitle ? (
              <div className="flex flex-col gap-2 flex-1">
                <div className="flex items-center gap-2">
                  <Input
                    value={editTitle}
                    onChange={(e) => {
                      setEditTitle(e.target.value);
                      if (titleError) setTitleError(null);
                    }}
                    onKeyDown={handleKeyDown}
                    className="text-xl font-semibold text-gray-900 border-none shadow-none p-0 h-auto"
                    autoFocus
                    aria-invalid={!!titleError}
                    aria-describedby={titleError ? "title-error" : undefined}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSaveEdit}
                    className="p-1"
                  >
                    <Check className="w-4 h-4 text-green-600" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelEdit}
                    className="p-1"
                  >
                    <X className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
                {titleError && (
                  <div className="text-xs text-red-600 px-2 py-1 bg-red-50 border border-red-200 rounded">
                    {titleError}
                  </div>
                )}
              </div>
            ) : (
              <>
                <SheetTitle
                  className="text-xl font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 pl-0 pr-2 py-1 rounded transition-colors"
                  onClick={handleStartEdit}
                >
                  {selectedToolGroup?.name}
                </SheetTitle>
                <div className="flex items-center gap-2">
                  {onEditGroup && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditGroup(selectedToolGroup)}
                      className="p-2"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  )}
                  {onDeleteGroup && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteGroup(selectedToolGroup)}
                      className="p-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
          <SheetDescription>
       
          </SheetDescription>
        </SheetHeader>

        {/* Description */}
        <div className="px-6 pt-1 pb-2">
     
          <Textarea
            id="description"
            placeholder="Enter a description for this tool group..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={async () => {
              if (onUpdateGroupDescription && selectedToolGroup && !isSavingDescription) {
                setIsSavingDescription(true);
                try {
                  await onUpdateGroupDescription(selectedToolGroup.id, description);
                } catch (error) {
                  console.error("Error updating description:", error);
                } finally {
                  setIsSavingDescription(false);
                }
              }
            }}
            className="min-h-[80px] resize-none"
            rows={3}
            disabled={isSavingDescription}
          />
        </div>

        {/* Divider */}
        <div className="px-6 py-2">
          <div style={{ borderTop: '3px solid #9ca3af' }}></div>
        </div>

        {/* Search */}
        <div className="px-6 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search tools and servers..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-2 space-y-4 overflow-y-auto">
          {selectedToolGroup &&
            (() => {
              const actualToolGroup = toolGroups.find(
                (group) => group.id === selectedToolGroup.id,
              );
              if (!actualToolGroup) return null;

              // Get providers that are in this tool group
              const groupProviders = providers.filter(
                (provider) =>
                  actualToolGroup.services &&
                  Object.keys(actualToolGroup.services).includes(provider.name),
              );

              const filteredProviders = groupProviders
                .map((provider) => {
                  const toolNames =
                    actualToolGroup.services[provider.name] || [];
                  let providerTools = provider.originalTools.filter(
                    (tool: any) => toolNames.includes(tool.name),
                  );

                  // If no tools match the configured names, show all tools for this provider
                  // This handles cases where tool group was configured with incorrect tool names
                  if (providerTools.length === 0 && toolNames.length > 0) {
                    providerTools = provider.originalTools || [];
                  }

                  // Filter tools by search query
                  if (searchQuery) {
                    const searchLower = searchQuery.toLowerCase();

                    // Check if provider name matches search
                    const providerMatches = provider.name
                      .toLowerCase()
                      .includes(searchLower);

                    // Filter tools by name and description
                    providerTools = providerTools.filter(
                      (tool: any) =>
                        tool.name.toLowerCase().includes(searchLower) ||
                        (tool.description &&
                          tool.description.toLowerCase().includes(searchLower)),
                    );

                    // If provider name matches but no tools match, still show the provider
                    if (providerMatches && providerTools.length === 0) {
                      providerTools = provider.originalTools.filter(
                        (tool: any) => toolNames.includes(tool.name),
                      );
                    }
                  }

                  // Don't render provider if no tools match the search (unless provider name matches)
                  if (providerTools.length === 0) return null;

                  return {
                    provider,
                    tools: providerTools,
                  };
                })
                .filter(
                  (item): item is { provider: any; tools: any[] } =>
                    item !== null,
                );

              // Show "No tools found" message if search query doesn't match anything
              if (searchQuery && filteredProviders.length === 0) {
                return (
                  <div className="text-center py-8">
                    <div className="text-gray-500 text-sm">
                      No tools found matching "{searchQuery}"
                    </div>
                  </div>
                );
              }

              return filteredProviders.map(({ provider, tools }) => (
                <div
                  key={provider.name}
                  className="border border-gray-200 rounded-lg p-4 space-y-4 bg-white shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <DomainIcon provider={provider} size={32} />


                    <div className="flex-1">
                      <h3 className="capitalize font-semibold text-gray-900 text-lg">
                        {provider.name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        Tools for interacting with the {provider.name} API...
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {tools.map((tool: any, toolIndex: number) => (
                      <div
                        key={toolIndex}
                        className="flex items-center justify-between bg-gray-50 rounded-lg p-3 border border-gray-100"
                      >
                        <div className="flex items-start gap-2">
                          <p className="text-sm  font-medium cursive text-gray-700">
                             {tool.name}:
                          </p>

                          <p className="text-sm text-gray-500">
                            {tool.description || "Open new pull request"}
                          </p>
                        </div>
                      </div>
                    ))}

                    <div className="text-xs text-gray-500 mt-2">
                      {tools.length} tool{tools.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                </div>
              ));
            })()}
        </div>
      </SheetContent>
    </Sheet>
  );
}
