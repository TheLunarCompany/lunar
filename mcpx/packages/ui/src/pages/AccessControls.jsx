import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUpdateAppConfig } from "@/data/app-config";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PROFILE_NAME,
  useAccessControlsStore,
  useInitAccessControlsStore,
  useSocketStore,
} from "@/store";
import { Save, Shield, ShieldAlert, Undo } from "lucide-react";
import { useCallback, useMemo } from "react";
import YAML from "yaml";
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
    const newAppConfig = {
      yaml: YAML.stringify(appConfigUpdates),
    };
    await updateAppConfigAsync(newAppConfig);
    resetAppConfigUpdates();
  }, [appConfigUpdates, resetAppConfigUpdates, updateAppConfigAsync]);

  const mcpServers = useMemo(() => {
    return systemState?.targetServers.map((server) => ({
      name: server.name,
      tools: server.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
      })),
    }));
  }, [systemState?.targetServers]);

  const initAccessControlsStore = useInitAccessControlsStore();

  const discardChanges = useCallback(() => {
    initAccessControlsStore();
    resetAppConfigUpdates();
  }, [initAccessControlsStore, resetAppConfigUpdates]);

  return (
    <div className="min-h-screen w-full bg-[var(--color-bg-app)]">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 tracking-tight">
          AI Agent Control Interface
        </h1>

        <div className="w-full">
          <div className="bg-[var(--color-bg-container)] rounded-xl border border-[var(--color-border-primary)] shadow-xl">
            <Tabs defaultValue="profile" className="w-full">
              <div className="p-5 border-b border-[var(--color-border-primary)]">
                <TabsList className="grid grid-cols-2 rounded-lg gap-1.5">
                  <TabsTrigger
                    value="profile"
                    className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] data-[state=active]:bg-[var(--color-fg-interactive)] data-[state=active]:text-[var(--color-text-primary-inverted)] data-[state=active]:shadow"
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    Agent Profiles
                  </TabsTrigger>
                  <TabsTrigger
                    value="data"
                    className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] data-[state=active]:bg-[var(--color-fg-interactive)] data-[state=active]:text-[var(--color-text-primary-inverted)] data-[state=active]:shadow"
                  >
                    <ShieldAlert className="w-4 h-4 mr-2" />
                    Tool Groups
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="p-6">
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

            <div className="p-6 border-t border-[var(--color-border-primary)]">
              <div className="flex justify-between items-center">
                <p
                  className={cn("text-[var(--color-text-secondary)] text-sm", {
                    "text-[var(--color-fg-interactive)]": hasPendingChanges,
                    "text-[var(--color-text-secondary)]": !hasPendingChanges,
                  })}
                >
                  {hasPendingChanges ? "Unsaved changes" : "No changes"}
                </p>
                <div className="flex items-center gap-3">
                  <Button
                    onClick={discardChanges}
                    variant="outline"
                    disabled={isPending || !hasPendingChanges}
                    className={`${
                      hasPendingChanges
                        ? "bg-[var(--color-bg-interactive)] hover:bg-[var(--color-bg-interactive-hover)] text-[var(--color-fg-interactive)] hover:text-[var(--color-fg-interactive-hover)]"
                        : "bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] cursor-not-allowed"
                    }`}
                  >
                    <Undo className="w-4 h-4 mr-2" />
                    Discard
                  </Button>
                  <Button
                    onClick={saveConfiguration}
                    variant="outline"
                    className={`${
                      hasPendingChanges
                        ? "bg-[var(--color-bg-interactive)] hover:bg-[var(--color-bg-interactive-hover)] text-[var(--color-fg-interactive)] hover:text-[var(--color-fg-interactive-hover)]"
                        : "bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] cursor-not-allowed"
                    }`}
                    disabled={isPending || !hasPendingChanges}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {isPending ? (
                      <>
                        Updating...
                        <Spinner />
                      </>
                    ) : (
                      "Save"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
