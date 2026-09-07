export type InstanceStatus =
  | "initializing"
  | "idle"
  | "working"
  | "error"
  | "offline";

export type PanelStatus = Exclude<InstanceStatus, "idle" | "working">;

export const INSTANCE_STATUS_METADATA: Record<
  InstanceStatus,
  { label: string; description: string }
> = {
  initializing: {
    label: "Initializing",
    description: "Setting up your gateway",
  },
  idle: { label: "Idle", description: "Waiting for requests" },
  working: { label: "Working", description: "Processing active calls" },
  error: {
    label: "Error",
    description: "Something went wrong — check logs",
  },
  offline: { label: "Offline", description: "Not connected" },
};

export const INSTANCE_STATUS_PANEL_METADATA: Record<
  PanelStatus,
  { label: string; title: string; description: string }
> = {
  initializing: {
    label: "STARTING",
    title: "Preparing your MCPX workspace",
    description:
      "Setting up your gateway, servers, and agents. This usually takes a few seconds.",
  },
  error: {
    label: "ERROR",
    title: "MCPX needs attention",
    description:
      "The instance stopped unexpectedly. Check the logs or contact your administrator.",
  },
  offline: {
    label: "UNAVAILABLE",
    title: "MCPX is offline",
    description:
      "The gateway is not reachable right now. Servers, agents, and tool calls are unavailable.",
  },
};
