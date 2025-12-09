import React, { useMemo } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import CustomBadge from "@/components/CustomBadge";
import { Copy, Edit, Settings, Trash2, X } from "lucide-react";
import HierarchyBadge from "@/components/HierarchyBadge";
import { useDomainIcon } from "@/hooks/useDomainIcon";
import McpIcon from "../dashboard/SystemConnectivity/nodes/Mcpx_Icon.svg?react";
import { Tool } from "@modelcontextprotocol/sdk/types.js";

interface OriginalToolInfo {
  name: string;
  inputSchema?: Tool["inputSchema"];
  overrideParams?: Record<string, { value?: string }>;
}

interface ProviderInfo {
  name: string;
  icon?: string;
  originalTools: OriginalToolInfo[];
}

interface ToolDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tool: {
    name: string;
    description?: string;
    inputSchema?: Tool["inputSchema"];
    isCustom?: boolean;
    originalToolName?: string;
    originalToolId?: string;
    serviceName?: string;
    parameters?: Array<{ name: string; value?: string; description?: string }>;
    overrideParams?: Record<
      string,
      { value?: string; description?: { text: string } }
    >;
  };
  providers?: ProviderInfo[];
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onCustomize?: () => void;
}

// moved HierarchyBadge to shared component

export const ToolDetailsDialog: React.FC<ToolDetailsDialogProps> = ({
  isOpen,
  onClose,
  tool,
  providers = [],
  onEdit,
  onDuplicate,
  onDelete,
  onCustomize,
}) => {
  console.log("[ToolDetailsDialog] render", { tool });
  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  const providerIcon = useDomainIcon(tool?.serviceName ?? null);

  const providerSelectors = useMemo(() => {
    const map = new Map<string, ProviderInfo>();
    providers.forEach((provider) => {
      map.set(provider.name, provider);
    });
    return map;
  }, [providers]);

  const parameterEntries = useMemo(() => {
    // Get inputSchema from tool or fallback to providers
    const inputSchema =
      tool.inputSchema ||
      providerSelectors
        .get(tool.serviceName || "")
        ?.originalTools?.find(
          (t: OriginalToolInfo) =>
            t.name === (tool.originalToolName || tool.name),
        )?.inputSchema;

    if (!inputSchema?.properties) {
      return [];
    }

    const overridesByName: Record<
      string,
      { value?: string; description?: string }
    > = {};
    if (Array.isArray(tool.parameters)) {
      tool.parameters.forEach((param) => {
        if (!param?.name) return;

        const existing = overridesByName[param.name] || {};
        const next = { ...existing } as {
          value?: string;
          description?: string;
        };

        if (param.value !== undefined) {
          next.value = param.value;
        }

        if (param.description) {
          next.description = param.description;
        }

        overridesByName[param.name] = next;
      });
    }

    if (tool?.overrideParams) {
      Object.entries(tool.overrideParams).forEach(([name, override]) => {
        const existing = overridesByName[name] || {};
        const next = { ...existing } as {
          value?: string;
          description?: string;
        };
        if (override?.value !== undefined) {
          next.value = `${override.value}`;
        }
        if (override?.description?.text) {
          next.description = override.description.text;
        }
        overridesByName[name] = next;
      });
    }

    return Object.entries(inputSchema.properties).map(
      ([paramName, paramSchema]) => ({
        name: paramName,
        schema: paramSchema as { type?: string; description?: string },
        value: overridesByName[paramName]?.value,
        descriptionOverride: overridesByName[paramName]?.description,
        providerOverride: providerSelectors
          .get(tool.serviceName || "")
          ?.originalTools?.find(
            (t: OriginalToolInfo) =>
              t.name === (tool.originalToolName || tool.name),
          )?.overrideParams?.[paramName]?.value,
      }),
    );
  }, [
    tool.inputSchema,
    tool.parameters,
    tool.overrideParams,
    providerSelectors,
    tool.serviceName,
    tool.originalToolName,
    tool.name,
  ]);

  return (
    <Sheet open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <SheetContent
        side="right"
        className="!w-[600px] !max-w-[600px] bg-white p-0 border-[#B4108B] border-2 shadow-lg shadow-[#B4108B]/40 flex flex-col [&>button]:hidden overflow-y-auto"
      >
        <div
          className={`flex ${tool.isCustom ? "justify-between" : "justify-end"}  items-center gap-2 border-b border-gray-200 px-6 py-4`}
        >
          {tool.isCustom && (
            <CustomBadge
              color="blue"
              size="md"
              rounded="lg"
              label={<span>CUSTOM</span>}
              icon={
                <svg
                  className="w-5 h-5"
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
              }
            />
          )}
          <div>
            {tool.isCustom ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-2"
                  onClick={() => handleAction(onEdit!)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="p-2"
                  onClick={() => handleAction(onDuplicate!)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-2"
                  onClick={() => handleAction(onDelete!)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            ) : (
              onCustomize && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleAction(onCustomize!)}
                  className="p-2"
                >
                  <Edit className="w-4 h-4" />
                </Button>
              )
            )}
            <Button variant="ghost" className="p-2" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Header */}
        <div className="mx-6  bg-white border-b border-gray-200">
          {/* Tool Title Badge */}
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <SheetTitle>
                  <div className="flex items-center gap-2">
                    {providerIcon ? (
                      <img
                        src={providerIcon}
                        alt={`icon`}
                        className="h-12 w-12 rounded-full object-contain bg-white"
                      />
                    ) : (
                      <McpIcon
                        style={{
                          color: providerSelectors.get(tool.serviceName ?? "")
                            ?.icon,
                        }}
                        className="w-12 h-12"
                      />
                    )}

                    <div className="flex flex-col mt-[-3px]">
                      <p className="text-2xl">
                        {" "}
                        {(tool.serviceName ?? "").charAt(0).toUpperCase() +
                          (tool.serviceName ?? "").slice(1)}
                      </p>

                      {tool.isCustom ? (
                        <HierarchyBadge
                          serverName={tool.originalToolName || ""}
                          toolName={tool.name || ""}
                        />
                      ) : (
                        <HierarchyBadge
                          serverName={tool.name || ""}
                          toolName={""}
                        />
                      )}
                    </div>
                  </div>
                </SheetTitle>
              </div>
            </div>
          </div>
        </div>

        {/* Configuration Section */}
        <div className="mx-6  mt-4">
          <div className="flex flex-col items-start justify-start">
            {tool.isCustom && (
              <div className="mb-6">
                <h3 className="text-base font-medium font-semibold  mb-1">
                  Custom Tool Name
                </h3>
                <p className="text-[#231A4D] text-sm leading-relaxed">
                  {tool.name}
                </p>
              </div>
            )}

            <div className="mb-6">
              <h3 className="text-base font-medium font-semibold  mb-1">
                Description
              </h3>
              <p className="text-[#231A4D] text-sm leading-relaxed">
                {tool.description}
              </p>
            </div>
          </div>

          {/* Custom Tool Info */}

          {/* Parameters */}
          {tool.inputSchema?.properties &&
            Object.keys(tool.inputSchema.properties).length > 0 && (
              <div>
                <h3 className="text-base font-medium text-gray-800 mb-1">
                  Parameters
                </h3>

                {parameterEntries.length > 0 ? (
                  <div className="space-y-4  gap-4 pb-4">
                    {parameterEntries.map(
                      ({ name, schema, descriptionOverride }) => (
                        <div
                          key={name}
                          className="space-y-3  rounded-lg bg-[#F9F8FB]  border border-gray-200 rounded-lg p-3"
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <div className="text-sm font-bold ">{name}</div>
                              <span className="text-xs  bg-gray-200 px-2 py-1 rounded">
                                {schema.type || "unknown"}
                              </span>
                            </div>

                            <p className="text-xs  font-medium leading-relaxed">
                              {tool?.overrideParams?.[name]?.value}
                            </p>

                            {(descriptionOverride || schema.description) && (
                              <p className="text-xs text-[#827E95] leading-relaxed">
                                {tool?.overrideParams?.[name]?.description
                                  ?.text || schema.description}
                              </p>
                            )}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4 bg-white border border-gray-200">
                      <Settings className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-500">
                      No parameters available for this tool
                    </p>
                  </div>
                )}
              </div>
            )}

          {/* No Parameters Message */}
          {(!tool.inputSchema?.properties ||
            Object.keys(tool.inputSchema.properties).length === 0) && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4 bg-white border border-gray-200">
                <Settings className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500">
                No parameters available for this tool
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
