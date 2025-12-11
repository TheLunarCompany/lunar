import {
  ChevronLeft,
  ChevronRight,
  FileEdit,
  Trash2,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NoToolGroupsPlaceholder } from "@/components/tools/EmptyStatePlaceholders";
import { useDomainIcon } from "@/hooks/useDomainIcon";
import McpIcon from "../dashboard/SystemConnectivity/nodes/Mcpx_Icon.svg?react";
import { TargetServerNew } from "@mcpx/shared-model";
import { EllipsisActions } from "../ui/ellipsis-action";
import { ToolGroup } from "@/store/access-controls";

interface TransformedToolGroup {
  id: string;
  name: string;
  description?: string;
  icon: string;
  tools: Array<{
    name: string;
    provider: string;
    count: number;
  }>;
}

interface ToolGroupsSectionProps {
  transformedToolGroups: TransformedToolGroup[];
  toolGroups: ToolGroup[];
  currentGroupIndex: number;
  selectedToolGroup: string | null;
  onGroupNavigation: (direction: "left" | "right") => void;
  onGroupClick: (groupId: string) => void;
  onEditModeToggle: () => void;
  onEditGroup: (group: ToolGroup) => void;
  onEditToolGroup?: (group: ToolGroup) => void;
  isAddCustomToolMode: boolean;
  onDeleteGroup: (group: ToolGroup) => void;
  isEditMode: boolean;
  providers: TargetServerNew[];
  setCurrentGroupIndex: (index: number) => void;
  selectedToolGroupForDialog?: ToolGroup;
}

interface DomainIconProps {
  providerName: string;
  providers: TargetServerNew[];
  size?: number;
}

export function DomainIcon({
  providerName,
  providers,
  size = 16,
}: DomainIconProps) {
  const iconSrc = useDomainIcon(providerName);

  let imageColor = "black";
  if (!iconSrc) {
    const currProvider = providers.find(
      (provider) => provider.name === providerName,
    );
    imageColor = currProvider?.icon || imageColor;
  }

  return iconSrc ? (
    <img
      src={iconSrc}
      alt={`${providerName} icon`}
      className="object-contain"
      style={{ width: size, height: size }}
    />
  ) : (
    <McpIcon style={{ color: imageColor, width: size, height: size }} />
  );
}

export function ToolGroupsSection({
  onEditGroup,
  onEditToolGroup,
  onDeleteGroup,
  transformedToolGroups,
  toolGroups,
  currentGroupIndex,
  selectedToolGroup,
  onGroupNavigation,
  onGroupClick,
  onEditModeToggle,
  providers,
  setCurrentGroupIndex,
  selectedToolGroupForDialog,
}: ToolGroupsSectionProps) {
  const visibleGroups = transformedToolGroups.slice(
    currentGroupIndex * 8,
    (currentGroupIndex + 1) * 8,
  );

  return (
    <div className="mb-12">
      {transformedToolGroups.length > 0 ? (
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <div className="relative w-full">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Tool Group
              </h2>
            </div>

            <div className="flex items-center gap-4 overflow-hidden w-full">
              {currentGroupIndex > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onGroupNavigation("left")}
                  className="absolute left-0 top-1/2 transform -translate-y-1/2 z-10 bg-white shadow-md"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              )}

              <div className="grid grid-cols-4 gap-4 flex-1 w-full">
                {visibleGroups.slice(0, 8).map((group) => {
                  return (
                    <div
                      key={group.id}
                      data-group-id={group.id}
                      className={`rounded-lg border p-4 w-full cursor-pointer transition-colors min-h-[80px] ${
                        selectedToolGroup === group.id
                          ? "bg-[#4F33CC] border-[#4F33CC] hover:bg-[#4F33CC]"
                          : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                      } ${
                        selectedToolGroupForDialog &&
                        selectedToolGroupForDialog.id === group.id
                          ? "!border-[#B4108B] !shadow-lg !shadow-[#B4108B]/40"
                          : ""
                      }`}
                      onClick={() => onGroupClick(group.id)}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex flex-row items-start gap-3  justify-between w-full">
                          <div className="flex flex-row items-center gap-3  ">
                            <span
                              className={`text-xl min-w-12 w-12 min-h-12 h-12 rounded-full flex items-center justify-center bg-white border-2 ${
                                selectedToolGroup === group.id
                                  ? "border-[#4F33CC]"
                                  : "border-gray-200"
                              }`}
                            >
                              {group.icon}
                            </span>

                            <div>
                              <p
                                className="text-[18px] leading-[100%] text-[#231A4D] truncate max-w-[200px]"
                                title={group.name}
                              >
                                {group.name}
                              </p>
                              <p
                                className="text-[12px] text-[#231A4D] line-clamp-2 max-w-[200px]"
                                title={group.description || ""}
                                style={{
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {group.description || ""}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-start justify-start">
                            <EllipsisActions
                              items={[
                                ...(onEditToolGroup
                                  ? [
                                      {
                                        label: "Edit Tool Group",
                                        icon: <FileEdit />,
                                        callback: () => {
                                          const originalGroup = toolGroups.find(
                                            (g) => g.id === group.id,
                                          );
                                          if (originalGroup) {
                                            onEditToolGroup(originalGroup);
                                          }
                                        },
                                      },
                                    ]
                                  : []),
                                {
                                  label: "Update Tools",
                                  icon: <Wrench />,
                                  callback: () => {
                                    const originalGroup = toolGroups.find(
                                      (g) => g.id === group.id,
                                    );
                                    if (originalGroup) {
                                      onEditGroup(originalGroup);
                                    }
                                  },
                                },
                                {
                                  label: "Delete",
                                  icon: <Trash2 />,
                                  callback: () => {
                                    const originalGroup = toolGroups.find(
                                      (g) => g.id === group.id,
                                    );
                                    if (originalGroup) {
                                      onDeleteGroup(originalGroup);
                                    }
                                  },
                                },
                              ]}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {group.tools.slice(0, 5).map((tool, toolIndex) => (
                          <div
                            key={toolIndex}
                            className=" rounded-lg flex items-center gap-1 bg-white rounded px-2 py-1 text-xs border border-gray-200"
                          >
                            <DomainIcon
                              providerName={tool.provider}
                              providers={providers}
                            />
                            <span className="text-gray-600">
                              {tool.provider}
                            </span>
                            <span className="bg-gray-100 text-gray-400 rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium">
                              {tool.count}
                            </span>
                          </div>
                        ))}
                        {group.tools.length > 5 && (
                          <div className="flex items-center gap-1 bg-white rounded px-2 py-1 text-xs border border-gray-200">
                            <span className="bg-gray-100 text-gray-400 rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium">
                              +{group.tools.length - 5}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {currentGroupIndex <
                Math.ceil(transformedToolGroups.length / 8) - 1 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onGroupNavigation("right")}
                  className="absolute right-0 top-1/2 transform -translate-y-1/2 z-10 bg-white shadow-md"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              )}
            </div>

            {/* Pagination dots */}
            <div className="flex justify-center gap-2 mt-4">
              {Array.from({
                length: Math.ceil(transformedToolGroups.length / 8),
              }).map((_, index) => (
                <button
                  key={index}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentGroupIndex ? "bg-[#4F33CC]" : "bg-gray-300"
                  }`}
                  onClick={() => setCurrentGroupIndex(index)}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <NoToolGroupsPlaceholder onAction={onEditModeToggle} />
      )}
    </div>
  );
}
