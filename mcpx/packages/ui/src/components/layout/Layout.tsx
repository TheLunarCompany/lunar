import { AddServerModal } from "@/components/dashboard/AddServerModal";
import { McpxConfigError } from "@/components/dashboard/McpxConfigError";
import { McpxNotConnected } from "@/components/dashboard/McpxNotConnected";
import { ServerDetailsModal } from "@/components/dashboard/ServerDetailsModal";
import { McpRemoteWarningBanner } from "@/components/ui/McpRemoteWarningBanner";
import { ProvisioningScreen } from "@/components/ProvisioningScreen";
import { useMcpxConnection } from "@/hooks/useMcpxConnection";
import { useModalsStore, useSocketStore } from "@/store";
import { createPageUrl } from "@/utils";
import { ConnectedClient, SystemState } from "@mcpx/shared-model";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { TitlePhrase } from "@/components/ui/title-phrase";
import { LibrarySquare, Network, Wrench } from "lucide-react";
import { FC, PropsWithChildren, useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

// Helper function to check if there are configuration errors
const getConfigurationError = (systemState: SystemState | null) => {
  // Check for config error in system state
  if (systemState?.configError) {
    return systemState.configError;
  }
  return null;
};

const getNavigationItems = () => [
  {
    title: "Dashboard",
    url: createPageUrl("dashboard"),
    icon: Network,
  },
  {
    title: "Catalog",
    url: createPageUrl("catalog"),
    icon: LibrarySquare,
  },
  {
    title: "Tools",
    url: createPageUrl("tools"),
    icon: Wrench,
  },
];

type LayoutProps = PropsWithChildren<{
  enableConnection?: boolean;
}>;

export const Layout: FC<LayoutProps> = ({
  children,
  enableConnection = true,
}) => {
  const location = useLocation();

  // Connect to mcpx-server when authenticated
  useMcpxConnection(enableConnection);

  const {
    closeAddServerModal,
    isAddServerModalOpen,
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
    connectionRejectedHubRequired,
    isConnected,
    isPending,
    serializedAppConfig,
    systemState,
  } = useSocketStore((s) => ({
    connectError: s.connectError,
    connectionRejectedHubRequired: s.connectionRejectedHubRequired,
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

  const systemStateError = getConfigurationError(systemState);

  return systemStateError ? (
    <McpxConfigError message={systemStateError} />
  ) : (
    <>
      <SidebarProvider>
        <div className="flex w-full ">
          <Sidebar>
            <SidebarHeader className="border h-[72px] flex justify-center px-6">
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
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {getNavigationItems().map((item) => {
                        const isActive = location.pathname === item.url;

                        return (
                          <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton
                              asChild
                              className={`hover:bg-[var(--color-bg-interactive-hover)] hover:text-[var(--color-fg-interactive-hover)] transition-colors duration-200 rounded-lg mb-1 ${
                                isActive
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
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
                <SidebarGroup>
                  <SidebarGroupContent></SidebarGroupContent>
                </SidebarGroup>
              </div>
            </SidebarContent>
          </Sidebar>

          <main className="flex-1 flex flex-col">
            <div className="flex-1 bg-gray-100">
              {connectionRejectedHubRequired ? (
                <McpxConfigError message="Hub not connected" />
              ) : isMcpxConnectError ? (
                <McpxNotConnected />
              ) : isPending ? (
                <ProvisioningScreen />
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
      {!isAddServerModalDisabled && isAddServerModalOpen && (
        <AddServerModal onClose={closeAddServerModal} />
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
