import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
} from "react-router-dom";
import AuditLog from "@/pages/AuditLog";
import Dashboard from "@/pages/Dashboard";
import Tools from "@/pages/Tools";
import Catalog from "@/pages/Catalog";
import McpRegistry from "@/pages/McpRegistry";
import McpServers from "@/pages/McpServers";
import SavedSetups from "@/pages/SavedSetups";
import Skills from "@/pages/Skills";
import SkillCreateStart from "@/pages/SkillCreateStart";
import SkillCapabilitiesEditor from "@/pages/SkillCapabilitiesEditor";
import SkillAgentsEditor from "@/pages/SkillAgentsEditor";
import SkillDetail from "@/pages/SkillDetail";
import SkillEditor from "@/pages/SkillEditor";
import McpServerAdd from "@/pages/McpServerAdd";
import NotFound from "@/pages/NotFound";
import Capabilities from "@/pages/Capabilities";
import { LoginRoute, LogoutRoute } from "@/pages/Login";
import {
  AuthenticatedLayoutRoute,
  RootRoute,
} from "@/pages/app-route-components";
import { routes } from "@/routes";
import { isSkillsPageEnabled } from "@/config/runtime-config";

export function createAppRouter() {
  return createBrowserRouter(createAppRoutes());
}

export function createAppRoutes() {
  return createRoutesFromElements(
    <Route element={<RootRoute />}>
      <Route element={<AuthenticatedLayoutRoute />}>
        <Route path={routes.root} element={<Dashboard />} />
        <Route path={routes.dashboard} element={<Dashboard />} />
        <Route path={routes.capabilities} element={<Capabilities />} />
        <Route path={routes.mcpServers} element={<McpServers />} />
        <Route path={routes.mcpServerAdd} element={<McpServerAdd />} />
        {isSkillsPageEnabled() ? (
          <>
            <Route path={routes.skills} element={<Skills />} />
            <Route path={routes.skillNew} element={<SkillCreateStart />} />
            <Route path={routes.skillNewUpload} element={<SkillEditor />} />
            <Route path={routes.skillNewBlank} element={<SkillEditor />} />
            <Route path={routes.skillDetail} element={<SkillDetail />} />
            <Route path={routes.skillEditor} element={<SkillEditor />} />
            <Route
              path={routes.skillCapabilities}
              element={<SkillCapabilitiesEditor />}
            />
            <Route path={routes.skillAgents} element={<SkillAgentsEditor />} />
          </>
        ) : null}
        <Route path={routes.tools} element={<Tools />} />
        <Route path={routes.catalog} element={<Catalog />} />
        <Route path={routes.mcpRegistry} element={<McpRegistry />} />
        <Route path={routes.savedSetups} element={<SavedSetups />} />
        <Route path={routes.auditLog} element={<AuditLog />} />
        <Route path={routes.login} element={<LoginRoute />} />
        <Route path={routes.logout} element={<LogoutRoute />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Route>,
  );
}
