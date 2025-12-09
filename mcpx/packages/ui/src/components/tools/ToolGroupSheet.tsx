import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
} from "@/components/ui/sheet";
import { Edit, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import McpIcon from "../dashboard/SystemConnectivity/nodes/Mcpx_Icon.svg?react";
import { useDomainIcon } from "@/hooks/useDomainIcon";
import type { ToolGroup } from "@/store/access-controls";
import type { TargetServerNew } from "@mcpx/shared-model";

export const validateToolGroupName = (
  name: string,
): { isValid: boolean; error?: string } => {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return { isValid: false, error: "Tool Group name is required" };
  }

  const allowed = /^[A-Za-z0-9_\s-]+$/;
  if (!allowed.test(trimmedName)) {
    return {
      isValid: false,
      error:
        "Only letters, digits, spaces, dash (-) and underscore (_) are allowed",
    };
  }

  return { isValid: true };
};

interface ToolGroupSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedToolGroup: ToolGroup | null;
  toolGroups: ToolGroup[];
  providers: TargetServerNew[];
  onEditGroup?: (group: ToolGroup) => void;
  onDeleteGroup?: (group: ToolGroup) => void;
}

function DomainIcon({
  provider,
  size = 16,
}: {
  provider: TargetServerNew;
  size?: number;
}) {
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
}: ToolGroupSheetProps) {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[600px] !max-w-[600px] bg-white p-0 flex flex-col [&>button]:hidden gap-0"
      >
        <SheetHeader className="px-6">
          <div className="flex items-center justify-between mt-6 gap-2">
            <div
              className="flex-1 text-xl font-semibold text-gray-900"
              style={{ fontWeight: 600 }}
            >
              {toolGroups.find((g) => g.id === selectedToolGroup?.id)?.name ||
                selectedToolGroup?.name ||
                ""}
            </div>
            <div className="flex items-center ">
              {onEditGroup && selectedToolGroup && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEditGroup(selectedToolGroup)}
                  className="p-2"
                >
                  <Edit className="w-4 h-4" />
                </Button>
              )}
              {onDeleteGroup && selectedToolGroup && (
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
          <SheetDescription></SheetDescription>
        </SheetHeader>

        {/* Description */}
        {selectedToolGroup?.description && (
          <div className="px-6">
            <p className="text-sm" style={{ fontSize: "14px" }}>
              {selectedToolGroup.description}
            </p>
          </div>
        )}

        {/* Search */}
        <div className="px-6 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search tools and servers..."
              className="pl-10"
              style={{
                backgroundColor: "#FBFBFF",
                border: "1px solid #E2E2E2",
                color: "#000000",
              }}
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
                  let providerTools = provider.originalTools.filter((tool) =>
                    toolNames.includes(tool.name ?? ""),
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
                      (tool) =>
                        tool.name.toLowerCase().includes(searchLower) ||
                        (tool.description &&
                          tool.description.toLowerCase().includes(searchLower)),
                    );

                    // If provider name matches but no tools match, still show the provider
                    if (providerMatches && providerTools.length === 0) {
                      providerTools = provider.originalTools.filter((tool) =>
                        toolNames.includes(tool.name),
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
                .filter((item) => item !== null);

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
                    <p className="text-sm " style={{ color: "#231A4D" }}>
                      Tools for interacting with the {provider.name} API...
                    </p>
                    {tools.map((tool, toolIndex) => (
                      <div
                        key={toolIndex}
                        className="flex items-center justify-between rounded-lg p-4"
                        style={{
                          backgroundColor: "white",
                          border: "1px solid #E2E2E2",
                        }}
                      >
                        <div className="flex flex-col items-start gap-0.5">
                          {/* Tool Name */}
                          <p style={{ color: "#231A4D", fontWeight: 600 }}>
                            {tool.name}
                          </p>
                          <p style={{ color: "#231A4D", fontWeight: 400 }}>
                            {tool.description}
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
