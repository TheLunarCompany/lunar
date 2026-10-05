import { editor } from "monaco-editor";
import { AGENT_TYPES, AGENT_TYPE_PREFERENCE_ORDER } from "./constants";
import { AgentType } from "./types";
import { isRemoteUrlValid } from "@mcpx/toolkit-ui/src/utils/mcpJson";
import type { TargetServer } from "@mcpx/shared-model";
import { SERVER_STATUS, type McpServerStatus } from "@/types/mcp-server";
import { isActive } from "@/utils";

export const getAgentType = (
  agentIdentifier?: string,
  consumerTag?: string | null,
): AgentType | null => {
  const findMatchingType = (name: string): AgentType | null => {
    const lowerName = name.toLowerCase();
    const matchedTypes = new Set<AgentType>();

    for (const [type, patterns] of Object.entries(AGENT_TYPES)) {
      if (patterns.some((p) => lowerName.includes(p))) {
        matchedTypes.add(type as AgentType);
      }
    }

    if (matchedTypes.size === 0) return null;

    // Return first match according to preference order
    return (
      AGENT_TYPE_PREFERENCE_ORDER.find((type) => matchedTypes.has(type)) ?? null
    );
  };

  // Prefer identifier (e.g. clientInfo.name) first, then consumerTag
  if (agentIdentifier) {
    const result = findMatchingType(agentIdentifier);
    if (result) return result;
  }
  if (consumerTag) {
    return findMatchingType(consumerTag);
  }

  return null;
};

export const getStatusTextColor = (status: string) => {
  switch (status) {
    case "connecting":
      return "text-mcpx-text-secondary";
    case "connected_running":
    case "connected_stopped":
      return "text-mcpx-success-text";
    case "connected_inactive":
      return "text-mcpx-selected";
    case "pending_auth":
    case "pending_input":
      return "text-mcpx-warning-strong";
    case "connection_failed":
      return "text-destructive";
    default:
      return "text-mcpx-text-secondary";
  }
};

export const getStatusBackgroundColor = (status: string) => {
  switch (status) {
    case "connecting":
      return "bg-mcpx-surface-tertiary";
    case "connected_running":
    case "connected_stopped":
      return "bg-mcpx-success-bg";
    case "connected_inactive":
      return "bg-mcpx-selected-weak";
    case "pending_auth":
    case "pending_input":
      return "bg-mcpx-warning-bg";
    case "connection_failed":
      return "bg-mcpx-danger-bg";
    default:
      return "bg-mcpx-surface-tertiary";
  }
};

export const getStatusText = (status: string) => {
  switch (status) {
    case "connecting":
      return "Connecting...";
    case "connected_running":
      return "ACTIVE";
    case "connected_inactive":
      return "Inactive";
    case "connected_stopped":
      return "Connected";
    case "pending_auth":
      return "Pending Auth";
    case "pending_input":
      return "Missing Configuration";
    case "connection_failed":
      return "Connection Error";
    default:
      return "UNKNOWN";
  }
};

export const getServerStatusTextColor = (status: string) => {
  switch (status) {
    case "connecting":
      return "text-mcpx-text-secondary";
    case "connected":
      return "text-mcpx-success-text";
    case "pending-auth":
      return "text-mcpx-warning-strong";
    case "pending-input":
      return "text-mcpx-warning-strong";
    case "connection-failed":
      return "text-mcpx-danger-text";
    case "inactive":
      return "text-mcpx-selected";
    default:
      return "text-mcpx-text-secondary";
  }
};

export const getServerStatusBackgroundColor = (status: string) => {
  switch (status) {
    case "connecting":
      return "bg-mcpx-surface-tertiary";
    case "connected":
      return "bg-mcpx-success-bg";
    case "pending-auth":
      return "bg-mcpx-warning-bg";
    case "pending-input":
      return "bg-mcpx-warning-bg";
    case "connection-failed":
      return "bg-mcpx-danger-bg";
    case "inactive":
      return "bg-mcpx-selected-weak";
    default:
      return "bg-mcpx-surface-tertiary";
  }
};

export const getServerStatusText = (status: string) => {
  switch (status) {
    case "connecting":
      return "Connecting...";
    case "connected":
      return "Active";
    case "pending-auth":
      return "Pending Auth";
    case "pending-input":
      return "Missing Configuration";
    case "connection-failed":
      return "Connection Error";
    case "inactive":
      return "Inactive";
    default:
      return "UNKNOWN";
  }
};

export function getMcpServerStatusFromTargetServer(
  server: TargetServer,
  options: { inactive?: boolean } = {},
): McpServerStatus {
  const status = (() => {
    switch (server.state.type) {
      case "connecting":
        return SERVER_STATUS.connecting;
      case "connected":
        return isActive(server.usage?.lastCalledAt)
          ? SERVER_STATUS.connected_running
          : SERVER_STATUS.connected_stopped;
      case "connection-failed":
        return SERVER_STATUS.connection_failed;
      case "pending-auth":
        return SERVER_STATUS.pending_auth;
      case "pending-input":
        return SERVER_STATUS.pending_input;
    }
  })();

  if (
    options.inactive === true &&
    (status === SERVER_STATUS.connected_running ||
      status === SERVER_STATUS.connected_stopped)
  ) {
    return SERVER_STATUS.connected_inactive;
  }

  return status;
}

export function highlightEnvKeys(
  model: editor.ITextModel,
  monaco: typeof import("monaco-editor"),
): editor.IModelDeltaDecoration[] {
  const text = model.getValue();

  const envMatches = [...text.matchAll(/"env"\s*:\s*{([^}]*?)}/g)];

  const decorations = envMatches.flatMap((match) => {
    const envContent = match[1];
    const offset = match.index + match[0].indexOf(envContent);

    const keyRegex = /"([^"]+)"\s*:/g;
    const keys = [...envContent.matchAll(keyRegex)];

    const keyDecorations = keys.map((k) => {
      const start = model.getPositionAt(offset + k.index + 1);
      const end = model.getPositionAt(offset + k.index + 1 + k[1].length);
      return {
        range: new monaco.Range(
          start.lineNumber,
          start.column,
          end.lineNumber,
          end.column,
        ),
        options: {
          inlineClassName: "monacoHighlightField",
        },
      };
    });

    const valueRegex = /:\s*"([^"]*)"/g;
    const values = [...envContent.matchAll(valueRegex)];
    const valueDecorations = values.map((v) => {
      const start = model.getPositionAt(
        offset + v.index + v[0].indexOf('"') + 1,
      );
      const end = model.getPositionAt(offset + v.index + v[0].length - 1);
      return {
        range: new monaco.Range(
          start.lineNumber,
          start.column,
          end.lineNumber,
          end.column,
        ),
        options: {
          inlineClassName: "monacoHighlightField",
        },
      };
    });

    return [...keyDecorations, ...valueDecorations];
  });

  return decorations;
}

export function highlightInvalidRemoteUrls(
  model: editor.ITextModel,
  monaco: typeof import("monaco-editor"),
): editor.IModelDeltaDecoration[] {
  const text = model.getValue();
  const matches = [...text.matchAll(/"url"\s*:\s*"([^"]*)"/g)];

  return matches.flatMap((m) => {
    const value = m[1];
    if (isRemoteUrlValid(value)) return [];
    if (m.index === undefined) return [];

    const valueStartOffset = m.index + m[0].length - 1 - value.length;
    const valueEndOffset = valueStartOffset + value.length;

    const start = model.getPositionAt(valueStartOffset);
    const end = model.getPositionAt(valueEndOffset);

    return [
      {
        range: new monaco.Range(
          start.lineNumber,
          start.column,
          end.lineNumber,
          end.column,
        ),
        options: { inlineClassName: "monacoHighlightField" },
      },
    ];
  });
}
