import { Outlet } from "react-router-dom";
import { NuqsAdapter } from "nuqs/adapters/react-router/v7";
import { Layout } from "@/components/layout/Layout";
import { useEnterpriseAuth } from "@/components/EnterpriseAuthCheck";
import LoadingScreen from "@/components/LoadingScreen";
import UnauthorizedScreen from "@/components/UnauthorizedScreen";
import EnterpriseLoginScreen from "@/components/EnterpriseLoginScreen";
import { useAuth } from "@/contexts/useAuth";
import { ProvisioningScreen } from "@/components/ProvisioningScreen";

export function RootRoute() {
  return (
    <NuqsAdapter>
      <Outlet />
    </NuqsAdapter>
  );
}

export function AuthenticatedLayoutRoute() {
  const {
    loginRequired,
    isAuthenticated: isUserAuthenticated,
    loading: authLoading,
  } = useAuth();

  const { isLoading, isAuthenticated, error, isPendingAllocation } =
    useEnterpriseAuth({
      enabled: !loginRequired || isUserAuthenticated,
    });

  if (loginRequired) {
    if (authLoading) {
      return <LoadingScreen />;
    }

    if (!isUserAuthenticated) {
      return <EnterpriseLoginScreen />;
    }
  }

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (isPendingAllocation) {
    return (
      <Layout enableConnection={false}>
        <ProvisioningScreen message={error || undefined} />
      </Layout>
    );
  }

  if (!isAuthenticated) {
    return <UnauthorizedScreen message={error || undefined} />;
  }

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
