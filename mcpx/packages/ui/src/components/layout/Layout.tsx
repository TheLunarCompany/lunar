import { AddServerModal } from "@/components/dashboard/AddServerModal";
import { McpxConfigError } from "@/components/dashboard/McpxConfigError";
import { McpxNotConnected } from "@/components/dashboard/McpxNotConnected";
import { ServerDetailsModal } from "@/components/dashboard/ServerDetailsModal";
import { ProvisioningScreen } from "@/components/ProvisioningScreen";
import { McpRemoteWarningBanner } from "@/components/ui/McpRemoteWarningBanner";
import { McpxSidebar } from "@/components/layout/sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { FC, PropsWithChildren, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { UserDetails } from "@/components/UserDetails";
import { useAuth } from "@/contexts/useAuth";
import { useMcpxConnection } from "@/hooks/useMcpxConnection";
import { useModalsStore, useSocketStore } from "@/store";
import { ConnectedClient, SystemState } from "@mcpx/shared-model";

// Helper function to check if there are configuration errors
const getConfigurationError = (systemState: SystemState | null) => {
  // Check for config error in system state
  if (systemState?.configError) {
    return systemState.configError;
  }
  return null;
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
  const pathToId: Record<string, string> = {
    "/dashboard": "dashboard",
    "/catalog": "catalog",
    "/tools": "tools",
    "/saved-setups": "saved-setups",
  };
  const activeItemId = pathToId[location.pathname] ?? "dashboard";

  const systemStateError = getConfigurationError(systemState);
  return systemStateError ? (
    <McpxConfigError message={systemStateError} />
  ) : (
    <>
      <SidebarProvider>
        <div
          data-testid="layout-shell"
          className="grid h-svh w-full grid-cols-[16rem_minmax(0,1fr)] gap-1.5 bg-[#fcfcfc] bg-[linear-gradient(135deg,#dad9f6_0%,rgb(255_207_236_/_0.5)_100%)] p-1.5"
        >
          <McpxSidebar
            activeItemId={activeItemId}
            collapsible="none"
            className="min-h-0 overflow-hidden rounded-xl"
          >
            {loginRequired ? (
              user ? (
                <UserDetails />
              ) : (
                <button
                  onClick={() => login()}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-white transition-colors hover:bg-primary/80"
                >
                  Login
                </button>
              )
            ) : null}
          </McpxSidebar>

          <main className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[12px] bg-white">
            <div className="flex min-h-0 flex-1 bg-white">
              {connectionRejectedHubRequired ? (
                <McpxConfigError
                  message="Hub not connected"
                  fullScreen={false}
                />
              ) : isMcpxConnectError ? (
                <McpxNotConnected fullScreen={false} />
              ) : isPending ? (
                <ProvisioningScreen />
              ) : isEditConfigurationDisabled ? (
                <McpxConfigError message={null} fullScreen={false} />
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
