import { AddServerModal } from "@/components/dashboard/AddServerModal";
import { McpxConfigError } from "@/components/dashboard/McpxConfigError";
import { ServerDetailsModal } from "@/components/dashboard/ServerDetailsModal";
import { InstanceStatusScreen } from "@/components/instance-status/InstanceStatusScreen";
import { ProvisioningScreen } from "@/components/ProvisioningScreen";
// import { McpRemoteWarningBanner } from "@/components/ui/McpRemoteWarningBanner";
import { McpxSidebar } from "@/components/layout/sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { type FC, type PropsWithChildren } from "react";
import { useLocation } from "react-router-dom";
import { UserDetails } from "@/components/UserDetails";
import { OboEditBanner } from "@/components/OboEditBanner";
import { OboActorGuard } from "@/components/OboActorGuard";
import { useIdentityLiveSync } from "@/data/identity";
import { useAuth } from "@/contexts/useAuth";
import { useMcpxConnection } from "@/hooks/useMcpxConnection";
import { routes } from "@/routes";
import { useModalsStore, useSocketStore } from "@/store";
import { SystemState } from "@mcpx/shared-model";
import type { McpxProbeState } from "@/hooks/useMcpxProbe";
import type { InstanceStatus, PanelStatus } from "@/model/instance-status";

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
  probeState: McpxProbeState;
}>;
export const Layout: FC<LayoutProps> = ({
  children,
  enableConnection = true,
  probeState,
}) => {
  const location = useLocation();
  const { user, loginRequired, login } = useAuth();

  // Connect to mcpx-server when authenticated
  useMcpxConnection(enableConnection && probeState.type === "ready");
  // Keep cached identity in sync with hub-pushed changes (e.g. OBO start/finish)
  useIdentityLiveSync();

  const {
    closeAddServerModal,
    isAddServerModalOpen,
    closeServerDetailsModal,
    isServerDetailsModalOpen,
    selectedServerName,
  } = useModalsStore((s) => ({
    closeAddServerModal: s.closeAddServerModal,
    isAddServerModalOpen: s.isAddServerModalOpen,
    closeConfigModal: s.closeConfigModal,
    isConfigModalOpen: s.isConfigModalOpen,
    openConfigModal: s.openConfigModal,
    closeServerDetailsModal: s.closeServerDetailsModal,
    isServerDetailsModalOpen: s.isServerDetailsModalOpen,
    selectedServerName: s.selectedServerName,
  }));
  const {
    activeCallCount,
    connectError: isMcpxConnectError,
    connectionRejectedHubRequired,
    isConnected,
    isPending,
    serializedAppConfig,
    systemState,
  } = useSocketStore((s) => ({
    activeCallCount: s.activeCallCount,
    connectError: s.connectError,
    connectionRejectedHubRequired: s.connectionRejectedHubRequired,
    isConnected: s.isConnected,
    isPending: s.isPending,
    serializedAppConfig: s.serializedAppConfig,
    systemState: s.systemState,
  }));
  const isEditConfigurationDisabled = !isConnected || !serializedAppConfig;
  const isAddServerModalDisabled = !isConnected || !systemState;
  const approvalPending = probeState.type === "approval-pending";
  const probeStatus = getProbeStatus(probeState);
  const panelStatus = resolvePanelStatus({
    approvalPending,
    probeStatus,
    hasConnectionError: connectionRejectedHubRequired || isMcpxConnectError,
    isPending,
    isConnected,
  });
  const instanceStatus: InstanceStatus =
    panelStatus ?? (activeCallCount > 0 ? "working" : "idle");

  // const [showMcpRemoteWarning, setShowMcpRemoteWarning] = useState(false);
  // useEffect(() => {
  //   if (
  //     systemState?.connectedClients?.some(
  //       (client: ConnectedClient) =>
  //         client.clientInfo?.adapter?.name === "mcp-remote" &&
  //         client.clientInfo?.adapter?.support?.ping === false,
  //     )
  //   ) {
  //     setShowMcpRemoteWarning(true);
  //   }
  // }, [systemState]);
  const activeItemId = getActiveSidebarItemId(location.pathname);

  const systemStateError =
    probeState.type === "ready" && panelStatus === null
      ? getConfigurationError(systemState)
      : null;
  return systemStateError ? (
    <McpxConfigError message={systemStateError} />
  ) : (
    <>
      <SidebarProvider>
        <div className="flex h-svh w-full flex-col">
          <OboActorGuard />
          <OboEditBanner />
          <div
            data-testid="layout-shell"
            className="grid min-h-0 w-full flex-1 grid-cols-[16rem_minmax(0,1fr)] gap-1.5 bg-[#fcfcfc] bg-[linear-gradient(135deg,#dad9f6_0%,rgb(255_207_236_/_0.5)_100%)] p-1.5"
          >
            <McpxSidebar
              activeItemId={activeItemId}
              collapsible="none"
              className="min-h-0 overflow-hidden rounded-xl"
              instanceStatus={instanceStatus}
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
                {approvalPending ? (
                  <ProvisioningScreen />
                ) : panelStatus ? (
                  <InstanceStatusScreen status={panelStatus} />
                ) : isEditConfigurationDisabled ? (
                  <McpxConfigError message={null} fullScreen={false} />
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    {/*{showMcpRemoteWarning && (*/}
                    {/*  <div className="px-6 pt-6">*/}
                    {/*    <McpRemoteWarningBanner*/}
                    {/*      onClose={() => {*/}
                    {/*        setShowMcpRemoteWarning(false);*/}
                    {/*      }}*/}
                    {/*    />*/}
                    {/*  </div>*/}
                    {/*)}*/}
                    {children}
                  </div>
                )}
              </div>
            </main>
          </div>
        </div>
      </SidebarProvider>
      {!isAddServerModalDisabled && isAddServerModalOpen && (
        <AddServerModal onClose={closeAddServerModal} />
      )}
      {isServerDetailsModalOpen && (
        <ServerDetailsModal
          isOpen={isServerDetailsModalOpen}
          onClose={closeServerDetailsModal}
          serverName={selectedServerName || null}
        />
      )}
    </>
  );
};

function getProbeStatus(probeState: McpxProbeState): PanelStatus | null {
  switch (probeState.type) {
    case "checking":
      return "initializing";
    case "instance":
      return probeState.status;
    case "gateway-unavailable":
      return "offline";
    case "approval-pending":
    case "ready":
    case "unauthorized":
      return null;
  }
}

function resolvePanelStatus({
  approvalPending,
  probeStatus,
  hasConnectionError,
  isPending,
  isConnected,
}: {
  approvalPending: boolean;
  probeStatus: PanelStatus | null;
  hasConnectionError: boolean;
  isPending: boolean;
  isConnected: boolean;
}): PanelStatus | null {
  if (approvalPending) return "initializing";
  if (probeStatus) return probeStatus;
  if (hasConnectionError) return "offline";
  if (isPending || !isConnected) return "initializing";
  return null;
}

const sidebarRouteMatches: Array<{ path: string; id: string }> = [
  { path: routes.dashboard, id: "dashboard" },
  { path: routes.catalog, id: "catalog" },
  { path: routes.mcpRegistry, id: "mcp-registry" },
  { path: routes.mcpServers, id: "mcp-servers" },
  { path: routes.tools, id: "tools" },
  { path: routes.capabilities, id: "capabilities" },
  { path: routes.skills, id: "skills" },
  { path: routes.savedSetups, id: "saved-setups" },
  { path: routes.auditLog, id: "audit-log" },
];

function getActiveSidebarItemId(pathname: string) {
  const matchedItem = sidebarRouteMatches.find(
    (item) => pathname === item.path || pathname.startsWith(`${item.path}/`),
  );

  if (!matchedItem) {
    return "dashboard";
  }

  return matchedItem.id;
}
