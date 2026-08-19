import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { NuqsAdapter } from "nuqs/adapters/react-router/v7";
import { Layout } from "@/components/layout/Layout";
import { useMcpxProbe } from "@/hooks/useMcpxProbe";
import LoadingScreen from "@/components/LoadingScreen";
import EnterpriseLoginScreen from "@/components/EnterpriseLoginScreen";
import UnauthorizedScreen from "@/components/UnauthorizedScreen";
import { useAuth } from "@/contexts/useAuth";
import { ConnectionManager } from "@/components/ConnectionManager";
import { isToolsPageMockEnabled } from "@/mocks/tools-page/config";
import { useSocketStore } from "@/store";

export function RootRoute() {
  return (
    <NuqsAdapter>
      <Outlet />
    </NuqsAdapter>
  );
}

export function AuthenticatedLayoutRoute() {
  const hasTransportError = useSocketStore((state) => state.connectError);
  const {
    loginRequired,
    isAuthenticated: isUserAuthenticated,
    loading: authLoading,
  } = useAuth();

  const { state: probeState, refresh } = useMcpxProbe({
    enabled: !loginRequired || isUserAuthenticated,
  });

  useEffect(() => {
    if (hasTransportError) {
      refresh();
    }
  }, [hasTransportError, refresh]);

  if (loginRequired) {
    if (authLoading) {
      return <LoadingScreen />;
    }

    if (!isUserAuthenticated) {
      return <EnterpriseLoginScreen />;
    }
  }

  if (probeState.type === "unauthorized") {
    return <UnauthorizedScreen message={probeState.message} />;
  }

  const isProbeReady = probeState.type === "ready";

  return (
    <>
      <ConnectionManager enabled={isProbeReady && !isToolsPageMockEnabled} />
      <Layout probeState={probeState} enableConnection={isProbeReady}>
        <Outlet />
      </Layout>
    </>
  );
}
