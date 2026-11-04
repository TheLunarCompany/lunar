import { isPendoEnabled } from "@/config/runtime-config";

type PendoOptions = {
  visitor: { id: string };
  account: { id: string };
};

type PendoCall =
  | ["initialize" | "identify", PendoOptions]
  | ["track", string]
  | ["clearSession", { doNotTrack: boolean }]
  | ["stopSendingEvents" | "startSendingEvents"];

type PendoAgent = {
  _q?: PendoCall[];
  initialize: (options: PendoOptions) => void;
  identify: (options: PendoOptions) => void;
  track: (event: string) => void;
  clearSession?: (options: { doNotTrack: boolean }) => void;
  stopSendingEvents?: () => void;
  startSendingEvents?: () => void;
};

declare global {
  interface Window {
    pendo?: PendoAgent;
  }
}

const PENDO_APP_ID = "6f621fb5-a115-4088-7d59-9bad314c05dd";
const SCRIPT_ID = "boomi-pendo-sdk";
const pendoTracking = { suspended: false };

export const PENDO_EVENTS = {
  dashboardViewed: "AI Gateway / Dashboard - Dashboard - Viewed",
  navigationDashboardClicked:
    "AI Gateway / Navigation - Dashboard Link - Clicked",
  navigationMcpServersClicked:
    "AI Gateway / Navigation - MCP Servers Link - Clicked",
  navigationSavedSetupsClicked:
    "AI Gateway / Navigation - Saved Setups Link - Clicked",
  navigationAuditLogClicked:
    "AI Gateway / Navigation - Audit Log Link - Clicked",
  navigationMcpRegistryClicked:
    "AI Gateway / Navigation - MCP Registry Link - Clicked",
  addAgentClicked: "AI Gateway / Dashboard - Add Agent Button - Clicked",
  addServerClicked: "AI Gateway / Dashboard - Add Server Button - Clicked",
  agentTypeSelected: "AI Gateway / Add Agent - Agent Type - Selected",
  agentConfigTabOpened: "AI Gateway / Add Agent - Configuration Tab - Opened",
  agentConfigCopied: "AI Gateway / Add Agent - Configuration - Copied",
  addServerAllTabSelected: "AI Gateway / Add Server - All Tab - Selected",
  addServerCustomTabSelected: "AI Gateway / Add Server - Custom Tab - Selected",
  addServerMigrateTabSelected:
    "AI Gateway / Add Server - Migrate Tab - Selected",
  serverRowClicked: "AI Gateway / MCP Servers - Server Row - Clicked",
  mcpServersViewed: "AI Gateway / MCP Servers - MCP Servers Page - Viewed",
  serverSearchUsed: "AI Gateway / MCP Servers - Search Field - Used",
  savedSetupsViewed: "AI Gateway / Saved Setups - Saved Setups Page - Viewed",
  setupSaveClicked:
    "AI Gateway / Saved Setups - Save Current Setup Button - Clicked",
  setupSaved: "AI Gateway / Saved Setups - Setup - Saved",
  mcpRegistryViewed: "AI Gateway / MCP Registry - MCP Registry Page - Viewed",
  registryAllTabSelected: "AI Gateway / MCP Registry - All Tab - Selected",
  registryCustomTabSelected:
    "AI Gateway / MCP Registry - Custom Tab - Selected",
  registryMigrateTabSelected:
    "AI Gateway / MCP Registry - Migrate Tab - Selected",
  registrySearchUsed: "AI Gateway / MCP Registry - Search Field - Used",
  registryAddServerClicked:
    "AI Gateway / MCP Registry - Add Server Button - Clicked",
} as const;

export type PendoEvent = (typeof PENDO_EVENTS)[keyof typeof PENDO_EVENTS];

export function preparePendo(): PendoAgent {
  if (window.pendo) {
    if (!document.getElementById(SCRIPT_ID)) pendoTracking.suspended = false;
    return window.pendo;
  }

  const queue: NonNullable<PendoAgent["_q"]> = [];
  const pendo: PendoAgent = {
    _q: queue,
    initialize: (options): void => {
      queue.unshift(["initialize", options]);
    },
    identify: (options): void => {
      queue.push(["identify", options]);
    },
    track: (event): void => {
      queue.push(["track", event]);
    },
    clearSession: (options): void => {
      queue.push(["clearSession", options]);
    },
    stopSendingEvents: (): void => {
      queue.push(["stopSendingEvents"]);
    },
    startSendingEvents: (): void => {
      queue.push(["startSendingEvents"]);
    },
  };
  window.pendo = pendo;
  pendoTracking.suspended = false;
  return pendo;
}

export function installPendo(email: string, accountId: string): void {
  if (!email || !accountId) return;

  const identity = JSON.stringify([email, accountId]);
  const existingScript = document.getElementById(SCRIPT_ID);
  if (
    existingScript?.dataset["pendoIdentity"] === identity &&
    !pendoTracking.suspended
  ) {
    return;
  }

  const pendo = preparePendo();
  const options: PendoOptions = {
    visitor: { id: email },
    account: { id: accountId },
  };

  if (existingScript) {
    try {
      pendo.identify(options);
      if (pendoTracking.suspended) pendo.startSendingEvents?.();
      existingScript.dataset["pendoIdentity"] = identity;
    } catch {
      // Analytics must not interrupt the user's action.
    }
  } else {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.dataset["pendoIdentity"] = identity;
    script.async = true;
    script.src = `https://content.engagement.boomi.com/agent/static/${PENDO_APP_ID}/pendo.js`;
    document.head.appendChild(script);
    pendo.initialize(options);
  }
  pendoTracking.suspended = false;
}

export function suspendPendo(): void {
  if (pendoTracking.suspended) return;
  pendoTracking.suspended = true;

  const script = document.getElementById(SCRIPT_ID);
  if (!script) {
    window.pendo?._q?.splice(0);
    return;
  }
  delete script.dataset["pendoIdentity"];

  try {
    window.pendo?.clearSession?.({ doNotTrack: true });
  } catch {
    // Analytics must not interrupt the user's action.
  }
  try {
    window.pendo?.stopSendingEvents?.();
  } catch {
    // Analytics must not interrupt the user's action.
  }
}

export function trackPendoEvent(event: PendoEvent): void {
  try {
    if (!isPendoEnabled() || pendoTracking.suspended) return;
    const pendo = window.pendo;
    if (!pendo) {
      return;
    }
    pendo.track(event);
  } catch {
    // Analytics must not interrupt the user's action.
  }
}
