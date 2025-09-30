import { AddServerModal } from "@/components/dashboard/AddServerModal";
import ConfigurationModal from "@/components/dashboard/ConfigurationModal";
import { McpxConfigError } from "@/components/dashboard/McpxConfigError";
import { McpxNotConnected } from "@/components/dashboard/McpxNotConnected";
import { ServerDetailsModal } from "@/components/dashboard/ServerDetailsModal";
import { McpRemoteWarningBanner } from "@/components/ui/McpRemoteWarningBanner";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";
import { ConnectedClient, SystemState } from "@mcpx/shared-model";
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
import { FC, PropsWithChildren, useCallback, useState, useEffect } from "react";
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
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, user } = useAuth0();
  const isLoginEnabled = import.meta.env.VITE_ENABLE_LOGIN === "true";
  
  const {
    closeAddServerModal,
    isAddServerModalOpen,
    closeConfigModal,
    isConfigModalOpen,
    openConfigModal,
    closeServerDetailsModal,
    isServerDetailsModalOpen,
    selectedServer,
  } = useModalsStore((s) => ({
    closeAddServerModal: s.closeAddServerModal,
    isAddServerModalOpen: s.isAddServerModalOpen,
    closeConfigModal: s.closeConfigModal,
    isConfigModalOpen: s.isConfigModalOpen,
    openConfigModal: s.openConfigModal,
    closeServerDetailsModal: s.closeServerDetailsModal,
    isServerDetailsModalOpen: s.isServerDetailsModalOpen,
    selectedServer: s.selectedServer,
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
  const [showMcpRemoteWarning, setShowMcpRemoteWarning] = useState(false);

  useEffect(() => {
    if (
      systemState?.connectedClients?.some(
        (client: ConnectedClient) =>
          client.clientInfo?.adapter?.name === "mcp-remote" &&
          client.clientInfo?.adapter?.support?.ping === false,
      )
    ) {
      setShowMcpRemoteWarning(true);
    }
  }, [systemState]);

  const { mutateAsync: updateAppConfigAsync } = useUpdateAppConfig();

  const handleAppConfigImport = useCallback(
    async ({ appConfig }: { appConfig: Pick<SerializedAppConfig, "yaml"> }) => {
      // Parse YAML to object before sending to mcpx-server
      const YAML = await import("yaml");
      const parsedConfig = YAML.parse(appConfig.yaml);
      await updateAppConfigAsync(parsedConfig);
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
        <div className="flex w-full bg-[var(--color-bg-app)]">
          <Sidebar>
            <SidebarHeader className="border-b h-[72px] flex justify-center px-6">
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
                    by lunar.dev
                  </p>
                </div>
              </div>
            </SidebarHeader>

            <SidebarContent className="p-3 flex flex-col border-r h-full">
              <div className="flex-1">
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
              </div>

              {isLoginEnabled && !isLoading && (
                <SidebarGroup className="mt-6">
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {!isAuthenticated ? (
                        <SidebarMenuItem>
                          <SidebarMenuButton
                            onClick={() => navigate("/login")}
                            className="auth-login-button"
                          >
                            <div className="auth-login-content">
                              <span>Login to join your team</span>
                            </div>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ) : (
                        <>
                          <SidebarMenuItem>
                            <div className="auth-user-container">
                              <div className="auth-user-greeting">
                                Hey, {user?.email} !
                              </div>
                              <SidebarMenuButton
                                onClick={() => navigate("/logout")}
                                className="auth-logout-button"
                              >
                                <div className="auth-logout-content">
                                  <span>Logout</span>
                                </div>
                              </SidebarMenuButton>
                            </div>
                          </SidebarMenuItem>
                        </>
                      )}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              )}
            </SidebarContent>
          </Sidebar>

          <main className="flex-1 flex flex-col">
            <header className="bg-white h-[72px] z-[1] fixed w-full border-b border-[var(--color-border-primary)] px-6 py-4">
            </header>
            <div className="flex-1 bg-[#F8FAFC] mt-[72px]">
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
                <>
                  {showMcpRemoteWarning && (
                    <McpRemoteWarningBanner
                      onClose={() => {
                        setShowMcpRemoteWarning(false);
                      }}
                    />
                  )}
                  {children}
                </>
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
        />
      )}
      {isServerDetailsModalOpen && (
        <ServerDetailsModal
          isOpen={isServerDetailsModalOpen}
          onClose={closeServerDetailsModal}
          server={selectedServer || null}
        />
      )}

      <style>{`
        .auth-user-container {
          width: 100%;
          padding: 12px;
          background-color: var(--color-bg-interactive);
          border: 1px solid var(--color-border-primary);
          border-radius: 8px;
          margin-bottom: 8px;
        }
        
        .auth-user-greeting {
          font-size: 14px;
          font-weight: 500;
          color: var(--color-fg-interactive);
          margin-bottom: 8px;
        }
        
        .auth-logout-button {
          width: fit-content;
          background-color: var(--color-fg-interactive);
          color: white;
          font-size: 12px;
          font-weight: 500;
          border: none;
          border-radius: 4px;
          padding: 6px 12px;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }
        
        .auth-logout-button:hover {
          background-color: var(--color-fg-interactive-hover);
          color: white;
        }
        
        .auth-logout-content {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .auth-login-button {
          width: 100%;
          background-color:var(--color-fg-interactive);
          color: white;
          border: none;
          border-radius: 8px;
          margin-bottom: 4px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .auth-login-button:hover {
          background-color: var(--color-fg-interactive-hover);
          color: white;
        }
        
        .auth-login-content {
          padding: 10px 12px;
        }
      `}</style>
    </>
  );
};
