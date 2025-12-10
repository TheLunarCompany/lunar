import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import AccessControls from "@/pages/AccessControls";
import Dashboard from "@/pages/Dashboard";
import Tools from "@/pages/Tools";
import { LoginRoute, LogoutRoute } from "@/pages/Login";
import { useEnterpriseAuth } from "@/components/EnterpriseAuthCheck";
import LoadingScreen from "@/components/LoadingScreen";
import UnauthorizedScreen from "@/components/UnauthorizedScreen";
import EnterpriseLoginScreen from "@/components/EnterpriseLoginScreen";
import { useAuth } from "@/contexts/useAuth";
import { ProvisioningScreen } from "@/components/ProvisioningScreen";

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
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/access-controls" element={<AccessControls />} />
            <Route path="/tools" element={<Tools />} />
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/logout" element={<LogoutRoute />} />
          </Routes>
        </Layout>
      )}
    </Router>
  );
}
