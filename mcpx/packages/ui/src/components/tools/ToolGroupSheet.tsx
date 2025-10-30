import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { InlineEditor } from "@/components/ui/inline-editor";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Search, Edit, Trash2 } from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
// @ts-ignore - SVG import issue
import McpIcon from "../dashboard/SystemConnectivity/nodes/Mcpx_Icon.svg?react";
import { RemoteTargetServer } from "mcpx-server/src/model/target-servers";
import { useDomainIcon } from "@/hooks/useDomainIcon";

export const validateToolGroupName = (name: string): { isValid: boolean; error?: string } => {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return { isValid: false, error: "Tool Group name is required" };
  }

  const allowed = /^[A-Za-z0-9_\s-]+$/;
  if (!allowed.test(trimmedName)) {
    return {
      isValid: false,
      error: "Only letters, digits, spaces, dash (-) and underscore (_) are allowed",
    };
  }

  return { isValid: true };
};

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
  const [description, setDescription] = useState("");
  const [isSavingDescription, setIsSavingDescription] = useState(false);



  // Debounce timer for name updates
  const nameUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset search when sheet is closed
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Clear any pending updates and save immediately if there's a pending change
      if (nameUpdateTimeoutRef.current) {
        clearTimeout(nameUpdateTimeoutRef.current);
        nameUpdateTimeoutRef.current = null;
      }
      setSearchQuery("");
      setDescription("");
    }
    onOpenChange(open);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (nameUpdateTimeoutRef.current) {
        clearTimeout(nameUpdateTimeoutRef.current);
      }
    };
  }, []);

  // Handle tool name/description updates
  const handleToolUpdate = (toolIndex: number, field: 'name' | 'description', newValue: string) => {
    console.log(`Updating tool ${toolIndex} ${field}:`, newValue);
    // Here you would typically call an API to save the changes
  };

  // Initialize description when selectedToolGroup changes
  // Also sync name from toolGroups to ensure immediate updates
  useEffect(() => {
    if (selectedToolGroup) {
      const actualToolGroup = toolGroups.find((group) => group.id === selectedToolGroup.id);
      if (actualToolGroup) {
        setDescription(actualToolGroup.description || "");
        // Update the selectedToolGroup object reference so InlineEditor gets the updated name
        // This ensures the name in the drawer updates immediately when changed
        if (actualToolGroup.name !== selectedToolGroup.name) {
          // Force re-render by updating the parent component's state
          // The parent should already be updating selectedToolGroupForDialog, but we ensure it's synced
        }
      }
    }
  }, [selectedToolGroup, toolGroups]);



  const canEditGroup =
    selectedToolGroup?.id &&
    !(selectedToolGroup.name === "All tools");

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[600px] !max-w-[600px] bg-white p-0 flex flex-col [&>button]:hidden gap-0"
      >
        <SheetHeader className="px-6">
          <div className="flex items-center justify-between mt-6 gap-2">
            <div className="flex-1 text-xl">
              <InlineEditor
                value={
                  toolGroups.find((g) => g.id === selectedToolGroup?.id)?.name ||
                  selectedToolGroup?.name ||
                  ""
                }
                onSave={(newValue) => {
                  // Clear any pending debounced update
                  if (nameUpdateTimeoutRef.current) {
                    clearTimeout(nameUpdateTimeoutRef.current);
                    nameUpdateTimeoutRef.current = null;
                  }
                  // Save immediately on blur/enter
                  if (onUpdateGroupName && selectedToolGroup && newValue.trim()) {
                    onUpdateGroupName(selectedToolGroup.id, newValue);
                  }
                }}
                onChange={(newValue: string) => {
                  // Clear existing timeout
                  if (nameUpdateTimeoutRef.current) {
                    clearTimeout(nameUpdateTimeoutRef.current);
                  }
                  // Debounce the save to avoid too many API calls
                  nameUpdateTimeoutRef.current = setTimeout(() => {
                    if (onUpdateGroupName && selectedToolGroup && newValue.trim()) {
                      onUpdateGroupName(selectedToolGroup.id, newValue);
                    }
                    nameUpdateTimeoutRef.current = null;
                  }, 500); // 500ms debounce
                }}
                placeholder="Enter group name"
                className="!text-xl font-semibold text-gray-900"
                style={{ fontWeight: 600 }}
                disabled={!canEditGroup}
              />
            </div>
            <div className="flex items-center ">
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
          </div>
          <SheetDescription>

          </SheetDescription>
        </SheetHeader>

        {/* Description */}
        <div className="px-6 ">


        <InlineEditor
                value={selectedToolGroup?.description || "Enter a description"}
                onSave={async (newValue) => {
                  if (onUpdateGroupDescription && selectedToolGroup) {
                    await onUpdateGroupDescription(selectedToolGroup.id, newValue);
                  }
                }}
                className="!text-sm"
                autoWrap={true}
                style={{ fontSize:'14px' }}
                placeholder="Enter group name"
                disabled={!canEditGroup}
              />



          {/* <Textarea
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
            style={{ backgroundColor: '#FBFBFF', border: '1px solid #E2E2E2', color: '#FBFBFF' }}
            rows={3}
            disabled={isSavingDescription}
          /> */}
        </div>


        {/* Search */}
        <div className="px-6 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search tools and servers..."
              className="pl-10"
              style={{ backgroundColor: '#FBFBFF', border: '1px solid #E2E2E2', color: '#FBFBFF' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Tools Section */}
 

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
                  <div className="flex items-center gap-2">
                    <DomainIcon provider={provider} size={32} />
                    <div className="flex-1">
                      <h3 className="capitalize font-semibold text-gray-900 text-lg">
                        {provider.name}
                      </h3>
                    </div>
                  </div>


                  <div className="space-y-2">
                  <p className="text-sm " style={{ color: '#231A4D' }}>
                        Tools for interacting with the {provider.name} API...
                      </p>
                    {tools.map((tool: any, toolIndex: number) => (
                      <div
                        key={toolIndex}
                        className="flex items-center justify-between rounded-lg p-4"
                        style={{ backgroundColor: 'white', border: '1px solid #E2E2E2' }}
                      >
                        <div className="flex flex-col items-start gap-0.5">
                          {/* Tool Name */}
                          <p style={{ color: '#231A4D', fontWeight: 600 }}>{tool.name}</p>
                          <p style={{ color: '#231A4D', fontWeight: 400 }}>{ tool.description }</p>

                         


                          
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
