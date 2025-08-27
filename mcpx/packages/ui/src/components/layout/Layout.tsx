import { AddServerModal } from "@/components/dashboard/AddServerModal";
import ConfigurationModal from "@/components/dashboard/ConfigurationModal";
import { McpxConfigError } from "@/components/dashboard/McpxConfigError";
import { McpxNotConnected } from "@/components/dashboard/McpxNotConnected";
import { AuthButtons } from "@/components/AuthButtons";
import { SystemState } from "@mcpx/shared-model"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TitlePhrase } from "@/components/ui/title-phrase";
import { useUpdateAppConfig } from "@/data/app-config";
import { useModalsStore, useSocketStore } from "@/store";
import { createPageUrl } from "@/utils";
import { SerializedAppConfig } from "@mcpx/shared-model";
import { Network, Settings, Shield, Wrench } from "lucide-react";
import { FC, PropsWithChildren, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";

// Helper function to check if there are configuration errors
const getConfigurationError = (systemState: SystemState | null) => {
  // Check for config error in system state
  if (systemState?.configError) {
    return systemState.configError;
  }
  return null;
};

const navigationItems = [
  {
    title: "Dashboard",
    url: createPageUrl("dashboard"),
    icon: Network,
  },
  {
    title: "Access Controls",
    url: createPageUrl("access-controls"),
    icon: Shield,
  },
  {
    title: "Tools Catalog",
    url: createPageUrl("tools"),
    icon: Wrench,
  },
];

export const Layout: FC<PropsWithChildren> = ({ children }) => {
  const location = useLocation();
  const {
    closeAddServerModal,
    isAddServerModalOpen,
    closeConfigModal,
    isConfigModalOpen,
    openConfigModal,
  } = useModalsStore((s) => ({
    closeAddServerModal: s.closeAddServerModal,
    isAddServerModalOpen: s.isAddServerModalOpen,
    closeConfigModal: s.closeConfigModal,
    isConfigModalOpen: s.isConfigModalOpen,
    openConfigModal: s.openConfigModal,
  }));

  const {
    connectError: isMcpxConnectError,
    isConnected,
    isPending,
    serializedAppConfig,
    systemState,
  } = useSocketStore((s) => ({
    connectError: s.connectError,
    isConnected: s.isConnected,
    isPending: s.isPending,
    serializedAppConfig: s.serializedAppConfig,
    systemState: s.systemState,
  }));

  const isEditConfigurationDisabled = !isConnected || !serializedAppConfig;
  const isAddServerModalDisabled = !isConnected || !systemState;

  const { mutateAsync: updateAppConfigAsync } = useUpdateAppConfig();

  const handleAppConfigImport = useCallback(
    async ({ appConfig }: { appConfig: Pick<SerializedAppConfig, "yaml"> }) => {
      await updateAppConfigAsync(appConfig);
      closeConfigModal();
    },
    [closeConfigModal, updateAppConfigAsync],
  );

  const systemStateError = getConfigurationError(systemState);

  return systemStateError ? (
    <McpxConfigError message={systemStateError} />
  ) : (
    <>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-[var(--color-bg-app)]">
          <Sidebar className="border-r border-[var(--color-border-primary)] bg-[var(--color-bg-container)]">
            <SidebarHeader className="border-b border-[var(--color-border-primary)] p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[var(--color-fg-interactive)] to-[var(--color-fg-primary-accent)] rounded-xl flex items-center justify-center">
                  <Network className="w-6 h-6 text-[var(--color-text-primary-inverted)]" />
                </div>
                <div className="select-none">
                  <TitlePhrase>
                    <h2 className="font-bold text-[var(--color-text-primary)] text-lg">
                      MCPX
                    </h2>
                  </TitlePhrase>
                  <p className="text-xs text-[var(--color-text-secondary)] font-medium">
                    Control Plane
                  </p>
                </div>
              </div>
            </SidebarHeader>

            <SidebarContent className="p-3">
              <SidebarGroup>
                <SidebarGroupLabel className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider px-3 py-2">
                  Navigation
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {navigationItems.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          className={`hover:bg-[var(--color-bg-interactive-hover)] hover:text-[var(--color-fg-interactive-hover)] transition-colors duration-200 rounded-lg mb-1 ${
                            location.pathname === item.url
                              ? "bg-[var(--color-bg-interactive)] text-[var(--color-fg-interactive)] font-medium"
                              : "text-[var(--color-text-primary)]"
                          }`}
                        >
                          <Link
                            to={item.url}
                            className="flex items-center gap-3 px-3 py-2.5"
                          >
                            <item.icon className="w-5 h-5" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
              <SidebarGroup>
                <SidebarGroupLabel className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider px-3 py-2 mt-3">
                  Configuration
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={openConfigModal}
                        className="w-full hover:bg-[var(--color-bg-interactive-hover)] hover:text-[var(--color-fg-interactive-hover)] transition-colors duration-200 rounded-lg mb-1 text-[var(--color-text-primary)]"
                        disabled={isEditConfigurationDisabled}
                      >
                        <div className="flex items-center gap-3 px-3 py-1.5">
                          <Settings className="w-5 h-5" />
                          <span>Edit Configuration</span>
                        </div>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>

          <main className="flex-1 flex flex-col">
            <header className="bg-[var(--color-bg-container)] border-b border-[var(--color-border-primary)] px-6 py-4 md:hidden">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="hover:bg-[var(--color-bg-info-hover)] p-2 rounded-lg transition-colors duration-200 text-[var(--color-text-primary)]" />
                <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">
                  MCPX Control Plane
                </h1>
              </div>
            </header>
            <div className="flex-1 bg-[var(--color-bg-app)]">
              <AuthButtons />
              {isMcpxConnectError ? (
                <McpxNotConnected />
              ) : isPending ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-[var(--color-text-secondary)]">
                    Loading...
                  </p>
                </div>
              ) : isEditConfigurationDisabled ? (
                <McpxConfigError message={null} />
              ) : (
                children
              )}
            </div>
          </main>
        </div>
      </SidebarProvider>
      {!isEditConfigurationDisabled && isConfigModalOpen && (
        <ConfigurationModal
          isOpen={isConfigModalOpen}
          onClose={closeConfigModal}
          onConfigurationImport={handleAppConfigImport}
          currentAppConfigYaml={serializedAppConfig?.yaml}
        />
      )}
      {!isAddServerModalDisabled && isAddServerModalOpen && (
        <AddServerModal
          onClose={closeAddServerModal}
          onServerAdded={() => {
            closeAddServerModal();
          }}
        />
      )}
    </>
  );
};
