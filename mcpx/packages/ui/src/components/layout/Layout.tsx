import { AddServerModal } from "@/components/dashboard/AddServerModal";
import { McpxConfigError } from "@/components/dashboard/McpxConfigError";
import { McpxNotConnected } from "@/components/dashboard/McpxNotConnected";
import { ServerDetailsModal } from "@/components/dashboard/ServerDetailsModal";
import { ProvisioningScreen } from "@/components/ProvisioningScreen";
import { McpRemoteWarningBanner } from "@/components/ui/McpRemoteWarningBanner";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { TitlePhrase } from "@/components/ui/title-phrase";
import { isSavedSetupsEnabled } from "@/config/runtime-config";
import { Activity, Bookmark, LibrarySquare, Network, Wrench } from "lucide-react";
import { FC, PropsWithChildren, useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { UserDetails } from "@/components/UserDetails";
import { useAuth } from "@/contexts/useAuth";
import { useMcpxConnection } from "@/hooks/useMcpxConnection";
import { useModalsStore, useSocketStore } from "@/store";
import { createPageUrl } from "@/utils";
import { ConnectedClient, SystemState } from "@mcpx/shared-model";
import faviconUrl from "/favicon.svg";

// Helper function to check if there are configuration errors
const getConfigurationError = (systemState: SystemState | null) => {
  // Check for config error in system state
  if (systemState?.configError) {
    return systemState.configError;
  }
  return null;
};
const getNavigationItems = () => {
  const items = [
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
    {
      title: "Metrics",
      url: createPageUrl("metrics"),
      icon: Activity,
    },
  ];
  if (isSavedSetupsEnabled()) {
    items.push({
      title: "Saved Setups",
      url: createPageUrl("saved-setups"),
      icon: Bookmark,
    });
  }
  return items;
};
type LayoutProps = PropsWithChildren<{
  enableConnection?: boolean;
}>;
export const Layout: FC<LayoutProps> = ({
  children,
  enableConnection = true,
}) => {
  const location = useLocation();
  const { user, loginRequired, login } = useAuth();

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
            <SidebarHeader className="border-b h-[72px] flex justify-center px-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center">
                  <img src={faviconUrl} alt="MCPX" className="w-6 h-6" />{" "}
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
            <SidebarContent className="p-3 border-r">
              <SidebarGroup>
                <SidebarGroupLabel className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider px-3 py-2">
                  Navigation
                </SidebarGroupLabel>
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
            </SidebarContent>
            <SidebarFooter className="border-t border-[var(--color-border-primary)] p-3 shrink-0 bg-white">
              {loginRequired ? (
                user ? (
                  <UserDetails />
                ) : (
                  <button
                    onClick={() => login()}
                    className="flex items-center justify-center gap-2 px-3 py-2 text-sm bg-[var(--color-fg-interactive)] text-white rounded-md hover:bg-[var(--color-fg-interactive-hover)] transition-colors w-full"
                  >
                    Login
                  </button>
                )
              ) : null}
            </SidebarFooter>
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
    </>
  );
};
