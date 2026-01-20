import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ArrowRightIcon from "@/icons/arrow_line_rigth.svg?react";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  VisuallyHidden,
} from "@/components/ui/sheet";
import { Search, Hexagon } from "lucide-react";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useSocketStore } from "@/store";
import { toast, useToast } from "@/components/ui/use-toast";
import { McpxData } from "./SystemConnectivity/types";
import { type AppConfig } from "@mcpx/shared-model";
import {
  getStatusText,
  getStatusTextColor,
  getStatusBackgroundColor,
} from "./helpers";
import { McpxServerCard } from "./McpxServerCard";

const DRAWER_CLOSING_DELAY_MS = 100;

interface McpxDetailsModalProps {
  mcpxData: McpxData | null;
  isOpen: boolean;
  onClose: () => void;
}

export const McpxDetailsModal = ({
  mcpxData,
  isOpen,
  onClose,
}: McpxDetailsModalProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingServerToggles, setPendingServerToggles] = useState<
    Map<string, boolean>
  >(new Map());

  const { dismiss } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      dismiss();
      setPendingServerToggles(new Map());
    }
    setInternalOpen(isOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const { systemState } = useSocketStore((s) => ({
    systemState: s.systemState,
  }));

  const hasChanges = useMemo(() => {
    return pendingServerToggles.size > 0;
  }, [pendingServerToggles]);

  const getVersionNumber = (version: string) => {
    if (!version) return "Unknown";
    return version.split("-")[0];
  };

  const mcpxStatus = useMemo(() => {
    if (!mcpxData?.status) return "connected_stopped";
    return mcpxData.status === "running"
      ? "connected_running"
      : "connected_stopped";
  }, [mcpxData?.status]);

  const serversList = useMemo(() => {
    if (!systemState?.targetServers) return [];
    return systemState.targetServers
      .map((server) => ({
        name: server.name,
        toolsCount: server.tools?.length || 0,
        icon: server.icon,
        status: server.state?.type,
      }))
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      );
  }, [systemState?.targetServers]);

  const filteredServers = useMemo(() => {
    return serversList.filter((server) =>
      server.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [serversList, searchQuery]);

  const { appConfig, emitPatchAppConfig } = useSocketStore((s) => ({
    appConfig: s.appConfig,
    emitPatchAppConfig: s.emitPatchAppConfig,
  }));

  const saveConfiguration = useCallback(async () => {
    if (!mcpxData) {
      toast({
        title: "Error",
        description: "MCPX data is missing",
        variant: "destructive",
      });
      return;
    }

    if (pendingServerToggles.size === 0 || !appConfig) {
      return;
    }

    try {
      const appConfigTyped = appConfig as AppConfig & {
        targetServerAttributes?: Record<string, { inactive: boolean }>;
      };
      const currentTargetServerAttributes =
        appConfigTyped.targetServerAttributes ?? {};

      const updatedTargetServerAttributes = {
        ...currentTargetServerAttributes,
      };

      pendingServerToggles.forEach((isActive, serverName) => {
        const normalizedName = serverName.toLowerCase().trim();
        updatedTargetServerAttributes[normalizedName] = {
          ...updatedTargetServerAttributes[normalizedName],
          inactive: !isActive,
        };
      });

      const updatedConfig = {
        ...appConfig,
        targetServerAttributes: updatedTargetServerAttributes,
      };
      emitPatchAppConfig(updatedConfig);

      setPendingServerToggles(new Map());

      toast({
        title: "Success",
        description: "MCPX Gateway configuration updated successfully",
      });

      setTimeout(() => {
        onClose();
      }, DRAWER_CLOSING_DELAY_MS);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to update MCPX Gateway configuration";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [mcpxData, pendingServerToggles, appConfig, emitPatchAppConfig, onClose]);

  const handleClose = () => {
    dismiss();
    setInternalOpen(false);
    setTimeout(() => onClose(), 300);
  };

  return (
    <>
      {!isOpen || !mcpxData ? null : (
        <Sheet
          open={internalOpen}
          onOpenChange={(open: boolean) => !open && handleClose()}
        >
          <SheetContent
            side="right"
            aria-describedby={undefined}
            className="!w-[600px] gap-0 !max-w-[600px] bg-white p-0 flex flex-col [&>button]:hidden"
          >
            <VisuallyHidden>
              <SheetTitle>MCPX</SheetTitle>
            </VisuallyHidden>
            <SheetHeader className="px-6 pt-4 pb-4 flex flex-row justify-between items-center border-b gap-2 space-y-0">
              <div className="flex items-center gap-2">
                <div
                  className={`flex whitespace-nowrap gap-1 overflow-hidden items-center h-6 px-2 py-2 rounded-full text-xs font-medium ${getStatusBackgroundColor(mcpxStatus)} ${getStatusTextColor(mcpxStatus)}`}
                >
                  <div className="bg-current w-2 min-w-2 h-2 min-h-2 rounded-full"></div>
                  <span className="text-[12px] text-ellipsis">
                    {getStatusText(mcpxStatus)}
                  </span>
                </div>
              </div>
              <div className="flex space-y-0  items-start text-[#7F7999]">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-4 h-4"
                  onClick={handleClose}
                >
                  <ArrowRightIcon />
                </Button>
              </div>
            </SheetHeader>

            <div className="px-6 py-2  flex flex-col overflow-y-auto">
              <div className="flex items-end gap-2 text-lg font-semibold  mt-2 mb-1">
                <div className="w-12 h-12 rounded-[12px] flex items-center justify-center bg-gradient-to-b from-[var(--color-fg-interactive)] to-[var(--color-fg-primary-accent)]">
                  <Hexagon className="text-white w-6 h-6" strokeWidth={1} />
                </div>
                <div className="flex flex-col items-start ">
                  <p className="text-2xl font-medium capitalize">MCPX</p>
                  <div className="flex items-center px-1 text-[10px] h-[20px] rounded-[4px] text-[#7D7B98] border-[#7D7B98] border">
                    <span>
                      Version {getVersionNumber(mcpxData.version || "Unknown")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6">
              <div className="grid grid-cols-2 gap-6 text-sm w-full">
                <div className="text-left border border-gray-200 rounded-lg p-4">
                  <div className="text-gray-600 font-medium mb-1">Agents</div>
                  <div className="">
                    {systemState?.connectedClientClusters?.length || 0}
                  </div>
                </div>
                <div className="text-left border border-gray-200 rounded-lg p-4">
                  <div className="text-gray-600 font-medium mb-1">Servers</div>
                  <div className="">
                    {systemState?.targetServers?.length || 0}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 flex-1 flex flex-col overflow-hidden">
              <Separator className="my-4" />
              <div className="text-lg font-semibold mb-2">Servers</div>

              <div className="flex gap-4 items-center mb-3 flex-shrink-0">
                <div className="relative flex-1 flex-shrink-0">
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-10 py-[14px] px-4 bg-white border-[#D8DCED] rounded-[8px] text-[#AAABC3] focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus:border-[#D8DCED]"
                  />
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#AAABC3]" />
                </div>
              </div>

              <div className="space-y-3 overflow-y-auto pr-2 flex-1 min-h-0 pb-4">
                {filteredServers.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                    <h4 className="font-semibold  mb-2">No Servers</h4>
                    <p className="text-gray-600 mb-4">
                      No servers are currently connected.
                    </p>
                  </div>
                ) : (
                  filteredServers.map((server) => (
                    <McpxServerCard
                      key={server.name}
                      server={server}
                      pendingToggle={pendingServerToggles.get(server.name)}
                      onToggleChange={(checked) => {
                        setPendingServerToggles((prev) => {
                          const newMap = new Map(prev);
                          if (checked === undefined) {
                            newMap.delete(server.name);
                          } else {
                            newMap.set(server.name, checked);
                          }
                          return newMap;
                        });
                      }}
                    />
                  ))
                )}
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 bg-white flex-shrink-0">
              <div className="flex gap-3 justify-end">
                <Button
                  className=" disabled:bg-gray-400 disabled:cursor-not-allowed"
                  onClick={saveConfiguration}
                  disabled={!hasChanges}
                >
                  Save
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
};
