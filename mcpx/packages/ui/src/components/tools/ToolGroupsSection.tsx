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
import { TargetServer } from "@mcpx/shared-model";
import { EllipsisActions } from "../ui/ellipsis-action";
import { ToolGroup } from "@/store/access-controls";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { useRef, useEffect, useState } from "react";

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
  providers: TargetServer[];
  setCurrentGroupIndex: (index: number) => void;
  selectedToolGroupForDialog?: ToolGroup;
}

interface DomainIconProps {
  providerName: string;
  providers: TargetServer[];
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

interface TruncatedTitleProps {
  text: string;
}

function TruncatedTitle({ text }: TruncatedTitleProps): React.JSX.Element {
  const textRef = useRef<HTMLParagraphElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const checkTruncation = () => {
      if (textRef.current) {
        const { scrollWidth, clientWidth } = textRef.current;
        setIsTruncated(scrollWidth > clientWidth);
      }
    };

    checkTruncation();
    window.addEventListener("resize", checkTruncation);
    return () => window.removeEventListener("resize", checkTruncation);
  }, [text]);

  const titleElement = (
    <p
      ref={textRef}
      className="leading-[100%] truncate"
      style={{ color: "#231A4D", fontSize: "18px" }}
    >
      {text}
    </p>
  );

  if (isTruncated) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{titleElement}</TooltipTrigger>
        <TooltipContent>
          <p>{text}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return titleElement;
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
            <p
              className="font-semibold mb-4"
              style={{
                color: "var(--text-colours-color-text-primary)",
                fontSize: "16px",
              }}
            >
              Tool Group
            </p>

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
                      className={`rounded-lg border-2 p-4 w-full min-w-[130px] cursor-pointer transition-colors min-h-[80px] ${
                        selectedToolGroup === group.id
                          ? "bg-[var(--component-colours-color-fg-interactive-hover)] hover:bg-[var(--component-colours-color-fg-interactive-hover)] !border-[var(--component-colours-color-fg-interactive)] shadow-md shadow-[var(--component-colours-color-fg-interactive)]/30"
                          : "hover:bg-gray-100 border-[#D8DCED] hover:!border-[var(--component-colours-color-fg-interactive)] hover:shadow-md hover:shadow-[var(--component-colours-color-fg-interactive)]/30"
                      } ${
                        selectedToolGroupForDialog &&
                        selectedToolGroupForDialog.id === group.id
                          ? "!border-[var(--component-colours-color-fg-interactive)] shadow-md shadow-[var(--component-colours-color-fg-interactive)]/30"
                          : ""
                      }`}
                      style={{
                        backgroundColor:
                          selectedToolGroup === group.id
                            ? undefined
                            : "#F3F5FA",
                        ...(selectedToolGroup === group.id
                          ? {
                              borderColor:
                                "var(--component-colours-color-fg-interactive)",
                            }
                          : selectedToolGroupForDialog &&
                              selectedToolGroupForDialog.id === group.id
                            ? {
                                borderColor:
                                  "var(--component-colours-color-fg-interactive)",
                              }
                            : {}),
                      }}
                      onClick={() => onGroupClick(group.id)}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex flex-row items-start gap-3  justify-between w-full min-w-0">
                          <div className="flex flex-row items-center gap-3 flex-1 min-w-0">
                            <span
                              className={`text-xl min-w-12 w-12 min-h-12 h-12 rounded-full flex items-center justify-center bg-white border-2 flex-shrink-0 ${
                                selectedToolGroup === group.id
                                  ? "border-[var(--component-colours-color-fg-interactive-hover)]"
                                  : "border-gray-200"
                              }`}
                            >
                              {group.icon}
                            </span>

                            <div className="min-w-0 flex-1">
                              <TruncatedTitle text={group.name} />
                              <p
                                className="text-[12px] text-[var(--text-colours-color-text-primary)] line-clamp-2"
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
                            <span className="text-[var(--text-colours-color-text-primary)] font-[10px]">
                              {tool.provider}
                            </span>
                            <span className="bg-gray-100 text-[#7F7999] rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-medium">
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
                    index === currentGroupIndex
                      ? "bg-[var(--component-colours-color-fg-interactive-hover)]"
                      : "bg-gray-300"
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
