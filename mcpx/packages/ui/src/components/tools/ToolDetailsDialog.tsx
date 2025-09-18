import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Edit, Copy, Trash2, Settings, X } from "lucide-react";

interface ToolDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tool: {
    name: string;
    description?: string;
    inputSchema?: any;
    isCustom?: boolean;
    originalToolName?: string;
    originalToolId?: string;
    serviceName?: string;
  };
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onCustomize?: () => void;
}

export const ToolDetailsDialog: React.FC<ToolDetailsDialogProps> = ({
  isOpen,
  onClose,
  tool,
  onEdit,
  onDuplicate,
  onDelete,
  onCustomize,
}) => {
  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="!w-[600px] !max-w-[600px] bg-white p-0 flex flex-col [&>button]:hidden overflow-y-auto"
      >
        <SheetHeader className="p-4 pb-0">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              {tool.isCustom && (
                <div className="flex items-center gap-1">
                  <div className="w-6 h-6 rounded flex items-center justify-center">
                    <svg
                      className="w-4 h-4"
                      style={{ color: "#4F33CC" }}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                      <polyline points="3.27,6.96 12,12.01 20.73,6.96" />
                      <line x1="12" y1="22.08" x2="12" y2="12" />
                    </svg>
                  </div>
                  <span
                    className="text-xs font-medium"
                    style={{ color: "#4F33CC" }}
                  >
                    CUSTOM
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                {tool.isCustom ? (
                  <>
                    <Button
                      
                      size="sm"
                      onClick={() => handleAction(onEdit!)}
                      className="text-gray-600 hover:text-[#4F33CC] hover:bg-[#4F33CC] p-2"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      
                      size="sm"
                      onClick={() => handleAction(onDuplicate!)}
                      className="text-gray-600 hover:text-[#4F33CC] hover:bg-[#4F33CC] p-2"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      
                      size="sm"
                      onClick={() => handleAction(onDelete!)}
                      className="text-gray-600 hover:text-red-600 hover:bg-red-50 p-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <Button
                      
                      size="sm"
                      onClick={onClose}
                      className="text-gray-400 hover:text-gray-600 p-2"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <SheetTitle className="text-xl font-semibold text-gray-900">
                {tool.name}
              </SheetTitle>
              {!tool.isCustom && (
                <div className="flex items-center gap-2">
                  {onCustomize && (
                    <Button
                      
                      size="sm"
                      onClick={() => handleAction(onCustomize!)}
                      className="text-gray-600 hover:text-[#4F33CC] hover:bg-[#4F33CC] p-2"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    
                    size="sm"
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 p-2"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="px-4 pt-2 pb-0 flex-1 flex flex-col overflow-hidden">
          {/* Tool Description - Under Title */}
          <div className="mb-4">
            <p className="text-sm text-gray-600 leading-relaxed">
              {tool.description || "No description available"}
            </p>
          </div>

          <div className="space-y-6 flex-1 overflow-y-auto pb-6 min-h-0">
            {/* Custom Tool Info */}
            {tool.isCustom && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">
                  Custom Tool Information
                </h3>
                <div className="space-y-2">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">
                      This is a custom tool that you've created.
                    </span>
                  </p>
                  {tool.originalToolName && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Based on:</span>{" "}
                      {tool.originalToolName}
                    </p>
                  )}
                  {tool.originalToolId && (
                    <p className="text-sm text-gray-500">
                      <span className="font-medium">Original Tool ID:</span>{" "}
                      {tool.originalToolId}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Parameters */}
            {tool.inputSchema?.properties &&
              Object.keys(tool.inputSchema.properties).length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">
                    Parameters
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(tool.inputSchema.properties).map(
                      ([paramName, paramSchema]: [string, any]) => (
                        <div
                          key={paramName}
                          className="bg-gray-50 border border-gray-200 rounded-lg p-3"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-sm font-medium text-gray-900">
                              {paramName}
                            </div>
                            <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1">
                              {paramSchema.type || "unknown"}
                            </span>
                          </div>
                          {paramSchema.description && (
                            <p className="text-sm text-gray-600 leading-relaxed">
                              {paramSchema.description}
                            </p>
                          )}
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}

            {/* No Parameters Message */}
            {(!tool.inputSchema?.properties ||
              Object.keys(tool.inputSchema.properties).length === 0) && (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-1">
                  <Settings className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500">
                  No parameters available for this tool
                </p>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
