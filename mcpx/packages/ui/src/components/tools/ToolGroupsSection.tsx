import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NoToolGroupsPlaceholder } from "@/components/tools/EmptyStatePlaceholders";


interface ToolGroup {
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
  transformedToolGroups: ToolGroup[];
  currentGroupIndex: number;
  selectedToolGroup: string | null;
  onGroupNavigation: (direction: "left" | "right") => void;
  onGroupClick: (groupId: string) => void;
  onEditModeToggle: () => void;
  isEditMode: boolean;
  setCurrentGroupIndex: (index: number) => void;
}

export function ToolGroupsSection({
  transformedToolGroups,
  currentGroupIndex,
  selectedToolGroup,
  onGroupNavigation,
  onGroupClick,
  onEditModeToggle,
  isEditMode,
  setCurrentGroupIndex,
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
                {Array.from({ length: 8 }).map((_, index) => {
                  const group = visibleGroups[index];
                  if (group) {
                    return (
                      <div
                        key={group.id}
                        className={`rounded-lg border p-4 w-full cursor-pointer transition-colors ${
                          selectedToolGroup === group.id
                            ? "bg-[#4F33CC] border-[#4F33CC] hover:bg-[#4F33CC]"
                            : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                        }`}
                        onClick={() => onGroupClick(group.id)}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-2xl min-w-12 w-12 min-h-12 h-12 rounded-xl object-contain  flex items-center justify-center bg-white">{group.icon}</span>
                          <div>
                            <p className="text-[18px] leading-[100%] font-[Inter] font-[500] text-[#231A4D]">
                              {group.name}
                            </p>
                            <p className="truncate text-[12px] leading-[140%] font-[Inter] text-[#231A4D]"> {group.description}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {group.tools.slice(0, 5).map((tool, toolIndex) => (
                            <div
                              key={toolIndex}
                              className=" rounded-lg flex items-center gap-1 bg-white rounded px-2 py-1 text-xs border border-gray-200"
                            >

                                <span >{ group.icon || "🔧"}</span>





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
                  } else {
                    return (
                      <div key={`empty-${index}`} className="w-full h-[120px]">
                        {/* Empty space */}
                      </div>
                    );
                  }
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
