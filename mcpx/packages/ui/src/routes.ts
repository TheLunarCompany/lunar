export const routes = {
  root: "/",
  dashboard: "/dashboard",
  accessControls: "/access-controls",
  capabilities: "/capabilities",
  mcpServers: "/mcp-servers",
  skills: "/skills",
  skillNew: "/skills/new",
  skillNewUpload: "/skills/new/upload",
  skillNewBlank: "/skills/new/blank",
  skillDetail: "/skills/:id",
  skillEditor: "/skills/:id/edit",
  tools: "/tools",
  catalog: "/catalog",
  savedSetups: "/saved-setups",
  auditLog: "/audit-log",
  login: "/login",
  logout: "/logout",
} as const;

export type AppRoute = (typeof routes)[keyof typeof routes];
