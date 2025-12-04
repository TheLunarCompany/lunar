import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import AccessControls from "@/pages/AccessControls";
import Dashboard from "@/pages/Dashboard";
import Tools from "@/pages/Tools";
import { LoginRoute, LogoutRoute } from "@/pages/Login";
import { useEnterpriseAuth } from "@/components/EnterpriseAuthCheck";
import LoadingScreen from "@/components/LoadingScreen";
import UnauthorizedScreen from "@/components/UnauthorizedScreen";

export default function Pages() {
  const { isLoading, isAuthenticated, error } = useEnterpriseAuth();

  return (
    <Router>
      {isLoading ? (
        <LoadingScreen />
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
