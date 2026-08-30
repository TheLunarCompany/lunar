export const routes = {
  root: "/",
  dashboard: "/dashboard",
  capabilities: "/capabilities",
  mcpServers: "/mcp-servers",
  mcpServerAdd: "/mcp-servers/add",
  skills: "/skills",
  skillNew: "/skills/new",
  skillNewUpload: "/skills/new/upload",
  skillNewBlank: "/skills/new/blank",
  skillDetail: "/skills/:id",
  skillEditor: "/skills/:id/edit",
  skillCapabilities: "/skills/:id/capabilities",
  skillAgents: "/skills/:id/agents",
  tools: "/tools",
  catalog: "/catalog",
  mcpRegistry: "/mcp-registry",
  savedSetups: "/saved-setups",
  auditLog: "/audit-log",
  login: "/login",
  logout: "/logout",
} as const;

export type AppRoute = (typeof routes)[keyof typeof routes];
