import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUpdateAppConfig } from "@/data/app-config";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PROFILE_NAME,
  initAccessControlsStore,
  useAccessControlsStore,
  useSocketStore,
} from "@/store";
import { Group, Save, Shield, Undo } from "lucide-react";
import { useCallback, useEffect, useMemo } from "react";
import { AgentProfiles } from "../components/access-controls/AgentProfiles";
import { ToolGroups } from "../components/access-controls/ToolGroups";

export default function AccessControls() {
  const { mutateAsync: updateAppConfigAsync, isPending } = useUpdateAppConfig();

  const { systemState } = useSocketStore((s) => ({
    systemState: s.systemState,
  }));

  const {
    agentsList,
    appConfigUpdates,
    hasPendingChanges,
    profiles,
    resetAppConfigUpdates,
    setAgentsList,
    setProfiles,
    setToolGroups,
    toolGroups,
  } = useAccessControlsStore((state) => ({
    agentsList: state.agentsList,
    appConfigUpdates: state.appConfigUpdates,
    hasPendingChanges: state.hasPendingChanges,
    profiles: state.profiles,
    resetAppConfigUpdates: state.resetAppConfigUpdates,
    setAgentsList: state.setAgentsList,
    setProfiles: state.setProfiles,
    setToolGroups: state.setToolGroups,
    toolGroups: state.toolGroups,
  }));

  const saveConfiguration = useCallback(async () => {
    await updateAppConfigAsync(appConfigUpdates as Record<string, unknown>);
    resetAppConfigUpdates();
  }, [appConfigUpdates, resetAppConfigUpdates, updateAppConfigAsync]);

  const mcpServers = useMemo(() => {
    if (!systemState?.targetServers) return [];
    return systemState.targetServers.map((server) => ({
      name: server.name,
      tools: server.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
      })),
    }));
  }, [systemState?.targetServers]);

  // Reset the state when the page unmounts
  useEffect(() => initAccessControlsStore, []);

  return (
    <div className=" w-full bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-start gap-12 whitespace-nowrap">
          <h1 className="text-3xl font-bold mb-8 tracking-tight">
            AI Agent Control Interface
          </h1>
          <div className="flex justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <Button
                onClick={initAccessControlsStore}
                variant="secondary"
                disabled={isPending || !hasPendingChanges}
                className={`${
                  hasPendingChanges
                    ? "bg-(--color-bg-interactive) hover:bg-accent text-primary hover:text-primary/80"
                    : "bg-secondary hover:bg-secondary text-muted-foreground hover:text-muted-foreground cursor-not-allowed"
                }`}
              >
                <Undo className="w-4 h-4 mr-2" />
                Discard
              </Button>
              <Button
                onClick={saveConfiguration}
                variant="secondary"
                className={`${
                  hasPendingChanges
                    ? "bg-(--color-bg-interactive) hover:bg-accent text-primary hover:text-primary/80"
                    : "bg-secondary hover:bg-secondary text-muted-foreground hover:text-muted-foreground cursor-not-allowed"
                }`}
                disabled={isPending || !hasPendingChanges}
              >
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
            </div>
            <div
              className={cn("text-muted-foreground text-sm w-32", {
                "text-primary": isPending || hasPendingChanges,
              })}
            >
              <div className="flex items-center gap-2">
                {hasPendingChanges ? (
                  "Unsaved changes"
                ) : isPending ? (
                  <>
                    Saving... <Spinner className="w-4 h-4 mr-2 text-primary" />
                  </>
                ) : (
                  "No changes"
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="w-full">
          <div className="bg-card rounded-xl border border-border shadow-xl">
            <Tabs defaultValue="profile" className="w-full">
              <div className="p-5 border-b border-border">
                <TabsList className="grid grid-cols-2 rounded-lg gap-1.5">
                  <TabsTrigger
                    value="profile"
                    className="text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    Agent Profiles
                  </TabsTrigger>
                  <TabsTrigger
                    value="data"
                    className="text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                  >
                    <Group className="w-4 h-4 mr-2" />
                    Tool Groups
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="p-6 w-full h-[calc(100vh-211px)] overflow-x-hidden">
                <TabsContent value="profile" className="mt-0">
                  {Boolean(agentsList && mcpServers) && (
                    <AgentProfiles
                      agents={agentsList}
                      getIsAgentDisabledForProfile={({ profileId, agentId }) =>
                        profiles.some(
                          (p) =>
                            p.id !== profileId &&
                            p.name !== DEFAULT_PROFILE_NAME &&
                            p.agents.includes(agentId),
                        )
                      }
                      isPendingUpdateAppConfig={isPending}
                      mcpServers={mcpServers}
                      profiles={profiles}
                      setAgentsList={setAgentsList}
                      setProfiles={setProfiles}
                      setToolGroups={setToolGroups}
                      toolGroups={toolGroups}
                    />
                  )}
                </TabsContent>

                <TabsContent value="data" className="mt-0">
                  <ToolGroups
                    isPendingUpdateAppConfig={isPending}
                    mcpServers={mcpServers}
                    setProfiles={setProfiles}
                    setToolGroups={setToolGroups}
                    toolGroups={toolGroups}
                  />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
