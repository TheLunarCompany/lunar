export const routes = {
  root: "/",
  dashboard: "/dashboard",
  accessControls: "/access-controls",
  capabilities: "/capabilities",
  tools: "/tools",
  catalog: "/catalog",
  savedSetups: "/saved-setups",
  login: "/login",
  logout: "/logout",
} as const;

export type AppRoute = (typeof routes)[keyof typeof routes];
