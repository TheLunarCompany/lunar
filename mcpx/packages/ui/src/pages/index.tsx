import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { NuqsAdapter } from "nuqs/adapters/react-router/v7";
import { Layout } from "@/components/layout/Layout";
import AccessControls from "@/pages/AccessControls";
import AuditLog from "@/pages/AuditLog";
import Dashboard from "@/pages/Dashboard";
import Tools from "@/pages/Tools";
import Catalog from "@/pages/Catalog";
import SavedSetups from "@/pages/SavedSetups";
import Skills from "@/pages/Skills";
import SkillCreateStart from "@/pages/SkillCreateStart";
import SkillDetail from "@/pages/SkillDetail";
import SkillEditor from "@/pages/SkillEditor";
import NotFound from "@/pages/NotFound";
import Capabilities from "@/pages/Capabilities";
import { LoginRoute, LogoutRoute } from "@/pages/Login";
import { useEnterpriseAuth } from "@/components/EnterpriseAuthCheck";
import LoadingScreen from "@/components/LoadingScreen";
import UnauthorizedScreen from "@/components/UnauthorizedScreen";
import EnterpriseLoginScreen from "@/components/EnterpriseLoginScreen";
import { useAuth } from "@/contexts/useAuth";
import { ProvisioningScreen } from "@/components/ProvisioningScreen";
import { routes } from "@/routes";
import { isSkillsPageEnabled } from "@/config/runtime-config";

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
      <NuqsAdapter>
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
              <Route
                path={routes.accessControls}
                element={<AccessControls />}
              />
              <Route path={routes.capabilities} element={<Capabilities />} />
              {isSkillsPageEnabled() ? (
                <>
                  <Route path={routes.skills} element={<Skills />} />
                  <Route
                    path={routes.skillNew}
                    element={<SkillCreateStart />}
                  />
                  <Route
                    path={routes.skillNewUpload}
                    element={<SkillEditor />}
                  />
                  <Route
                    path={routes.skillNewBlank}
                    element={<SkillEditor />}
                  />
                  <Route path={routes.skillDetail} element={<SkillDetail />} />
                  <Route path={routes.skillEditor} element={<SkillEditor />} />
                </>
              ) : null}
              <Route path={routes.tools} element={<Tools />} />
              <Route path={routes.catalog} element={<Catalog />} />
              <Route path={routes.savedSetups} element={<SavedSetups />} />
              <Route path={routes.auditLog} element={<AuditLog />} />
              <Route path={routes.login} element={<LoginRoute />} />
              <Route path={routes.logout} element={<LogoutRoute />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        )}
      </NuqsAdapter>
    </Router>
  );
}
