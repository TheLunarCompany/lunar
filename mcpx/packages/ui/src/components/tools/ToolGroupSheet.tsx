import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Search, MoreHorizontal, Edit, Trash2 } from "lucide-react";

interface ToolGroupSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedToolGroup: any;
  toolGroups: any[];
  providers: any[];
  onEditGroup?: (group: any) => void;
  onDeleteGroup?: (group: any) => void;
}

export function ToolGroupSheet({
  isOpen,
  onOpenChange,
  selectedToolGroup,
  toolGroups,
  providers,
  onEditGroup,
  onDeleteGroup
}: ToolGroupSheetProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[600px] !max-w-[600px] bg-white p-0 flex flex-col [&>button]:hidden">
        <SheetHeader className="px-6">
          <div className="flex items-center justify-between mt-5 mb-2">
            <SheetTitle className="text-xl font-semibold text-gray-900">
              {selectedToolGroup?.name}
            </SheetTitle>
            <div className="flex items-center gap-2">
              {onEditGroup && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEditGroup(selectedToolGroup)}
                  className="text-gray-600 hover:text-[#4F33CC] hover:bg-[#4F33CC] p-2"
                >
                  <Edit className="w-4 h-4" />
                </Button>
              )}
              {onDeleteGroup && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeleteGroup(selectedToolGroup)}
                  className="text-gray-600 hover:text-red-600 hover:bg-red-50 p-2"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* Search */}
        <div className="px-6 py-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search tool..."
              className="pl-10"
            />
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-4 overflow-y-auto">
          {selectedToolGroup && (() => {
            const actualToolGroup = toolGroups.find(group => group.id === selectedToolGroup.id);
            if (!actualToolGroup) return null;

            // Get providers that are in this tool group
            const groupProviders = providers.filter(provider => 
              actualToolGroup.services && Object.keys(actualToolGroup.services).includes(provider.name)
            );

            return groupProviders.map((provider) => {
              const toolNames = actualToolGroup.services[provider.name] || [];
              const providerTools = provider.originalTools.filter((tool: any) => 
                toolNames.includes(tool.name)
              );

              return (
                <div key={provider.name} className="border border-gray-200 rounded-lg p-4 space-y-4 bg-white shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{provider.icon || "🔧"}</span>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-lg">{provider.name}</h3>
                      <p className="text-sm text-gray-500">
                        Tools for interacting with the {provider.name} API...
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {providerTools.map((tool: any, toolIndex: number) => (
                      <div key={toolIndex} className="flex items-center justify-between bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700">
                            {tool.name}
                          </span>
                          <span className="text-xs text-gray-500">
                            {tool.description || 'Open new pull request'}
                          </span>
                        </div>                 
                      </div>
                    ))}
                    
                    <div className="text-xs text-gray-500 mt-2">
                      {providerTools.length} tool{providerTools.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </SheetContent>
    </Sheet>
  );
}
