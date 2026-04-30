import {
  ChevronLeft,
  ChevronRight,
  Eye,
  FileEdit,
  Trash2,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NoToolGroupsPlaceholder } from "@/components/tools/EmptyStatePlaceholders";
import { TargetServer } from "@mcpx/shared-model";
import { EllipsisActions } from "../ui/ellipsis-action";
import { ToolGroup } from "@/store/access-controls";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { useRef, useEffect, useState } from "react";
import { DomainBadge } from "@/components/dashboard/DomainBadge";

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
        <div className="bg-white rounded-lg p-6 shadow-xs border border-gray-200">
          <div className="relative w-full">
            <p
              className="font-semibold mb-4"
              style={{
                color: "varforeground",
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

              <div className="grid grid-cols-4 gap-4 flex-1 w-full p-2">
                {visibleGroups.slice(0, 8).map((group) => {
                  const totalTools = group.tools.reduce(
                    (total, tool) => total + tool.count,
                    0,
                  );
                  const isSelected = selectedToolGroup === group.id;
                  const isDialogSelected =
                    selectedToolGroupForDialog?.id === group.id;

                  return (
                    <div
                      key={group.id}
                      data-tool-group-card
                      data-group-id={group.id}
                      className={`flex min-h-[156px] w-full min-w-[130px] cursor-pointer flex-col rounded-lg border bg-white p-4 transition-all ${
                        isSelected || isDialogSelected
                          ? "border-primary shadow-md shadow-primary/20 ring-2 ring-primary/15"
                          : "border-[var(--colors-gray-200)] hover:border-primary/60 hover:shadow-md"
                      }`}
                      onClick={() => onGroupClick(group.id)}
                    >
                      <div className="mb-4 flex min-w-0 items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <div className="flex min-w-0 flex-1 items-start gap-3">
                            <span
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-[var(--colors-gray-50)] text-lg ${
                                isSelected || isDialogSelected
                                  ? "border-primary/50"
                                  : "border-[var(--colors-gray-200)]"
                              }`}
                            >
                              {group.icon}
                            </span>

                            <div className="min-w-0 flex-1">
                              <TruncatedTitle text={group.name} />
                              <p
                                className="text-[12px] text-foreground line-clamp-2"
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

                          <EllipsisActions
                            items={[
                              {
                                label: "Details",
                                icon: <Eye />,
                                callback: () => onGroupClick(group.id),
                              },
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

                      <div className="mb-3 flex items-center justify-between gap-2 border-t border-[var(--colors-gray-200)] pt-3">
                        <span className="text-xs font-medium text-[var(--colors-gray-600)]">
                          {group.tools.length} server
                          {group.tools.length === 1 ? "" : "s"}
                        </span>
                        <span className="rounded-full bg-[var(--colors-gray-50)] px-2 py-0.5 text-xs font-medium text-[var(--colors-gray-600)]">
                          {totalTools} tool{totalTools === 1 ? "" : "s"}
                        </span>
                      </div>

                      <div className="mt-auto flex flex-wrap gap-2">
                        {group.tools.slice(0, 5).map((tool, toolIndex) => (
                          <DomainBadge
                            key={toolIndex}
                            domain={tool.provider}
                            groupId={group.id}
                          />
                        ))}
                        {group.tools.length > 5 && (
                          <div className="flex h-7 items-center rounded-md border border-[var(--colors-gray-200)] bg-[var(--colors-gray-50)] px-2 text-xs text-[var(--colors-gray-600)]">
                            +{group.tools.length - 5}
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
                      ? "bg-primary/80"
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
