import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import AccessControls from "@/pages/AccessControls";
import Dashboard from "@/pages/Dashboard";
import Tools from "@/pages/Tools";
import Catalog from "@/pages/Catalog";
import SavedSetups from "@/pages/SavedSetups";
import NotFound from "@/pages/NotFound";
import { LoginRoute, LogoutRoute } from "@/pages/Login";
import { useEnterpriseAuth } from "@/components/EnterpriseAuthCheck";
import LoadingScreen from "@/components/LoadingScreen";
import UnauthorizedScreen from "@/components/UnauthorizedScreen";
import EnterpriseLoginScreen from "@/components/EnterpriseLoginScreen";
import { useAuth } from "@/contexts/useAuth";
import { ProvisioningScreen } from "@/components/ProvisioningScreen";
import { routes } from "@/routes";

export default function Pages() {
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

  return (
    <Router>
      {isLoading ? (
        <LoadingScreen />
      ) : isPendingAllocation ? (
        <Layout enableConnection={false}>
          <ProvisioningScreen message={error || undefined} />
        </Layout>
      ) : !isAuthenticated ? (
        <UnauthorizedScreen message={error || undefined} />
      ) : (
        <Layout>
          <Routes>
            <Route path={routes.root} element={<Dashboard />} />
            <Route path={routes.dashboard} element={<Dashboard />} />
            <Route path={routes.accessControls} element={<AccessControls />} />
            <Route path={routes.tools} element={<Tools />} />
            <Route path={routes.catalog} element={<Catalog />} />
            <Route path={routes.savedSetups} element={<SavedSetups />} />
            <Route path={routes.login} element={<LoginRoute />} />
            <Route path={routes.logout} element={<LogoutRoute />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      )}
    </Router>
  );
}
