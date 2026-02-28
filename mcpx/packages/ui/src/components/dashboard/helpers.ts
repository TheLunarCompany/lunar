import { editor } from "monaco-editor";
import { AGENT_TYPES } from "./constants";
import { AgentType } from "./types";
import { isRemoteUrlValid } from "@mcpx/toolkit-ui/src/utils/mcpJson";

export const getAgentType = (
  agentIdentifier?: string,
  consumerTag?: string | null,
): AgentType | null => {
  // Helper function to check if a name matches any agent type
  const findMatchingType = (name: string): AgentType | null => {
    const lowerName = name.toLowerCase();
    return Object.keys(AGENT_TYPES).find((type) => {
      return lowerName.includes(AGENT_TYPES[type as AgentType]);
    }) as AgentType | null;
  };

  // Try consumer Tag first if available
  if (consumerTag) {
    const result = findMatchingType(consumerTag);
    if (result) return result;
  }

  // Fall back to identifier if consumerTag didn't match or wasn't provided
  if (agentIdentifier) {
    return findMatchingType(agentIdentifier);
  }

  return null;
};

export const getStatusTextColor = (status: string) => {
  switch (status) {
    case "connecting":
      return "text-[#6B7280]";
    case "connected_running":
    case "connected_stopped":
      return "text-[var(--color-fg-success)]";
    case "connected_inactive":
      return "text-[#4120A4]";
    case "pending_auth":
    case "pending_input":
      return "text-[#FF9500]";
    case "connection_failed":
      return "text-[var(--color-fg-danger)]";
    default:
      return "text-gray-600";
  }
};

export const getStatusBackgroundColor = (status: string) => {
  switch (status) {
    case "connecting":
      return "bg-[#F3F4F6]";
    case "connected_running":
    case "connected_stopped":
      return "bg-[var(--color-bg-success)]";
    case "connected_inactive":
      return "bg-[#EBE6FB]";
    case "pending_auth":
    case "pending_input":
      return "bg-[#FFF5E6]";
    case "connection_failed":
      return "bg-[var(--color-bg-danger)]";
    default:
      return "bg-gray-100";
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
      return "Pending Authentication";
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
      return "text-[#6B7280]";
    case "connected":
      return "text-[#00B271]";
    case "pending-auth":
      return "text-[#FF9500]";
    case "pending-input":
      return "text-[#FF9500]";
    case "connection-failed":
      return "text-[#AD0149]";
    case "inactive":
      return "text-[#4120A4]";
    default:
      return "text-gray-600";
  }
};

export const getServerStatusBackgroundColor = (status: string) => {
  switch (status) {
    case "connecting":
      return "bg-[#F3F4F6]";
    case "connected":
      return "bg-[#D7F3E8]";
    case "pending-auth":
      return "bg-[#FFF5E6]";
    case "pending-input":
      return "bg-[#FFF5E6]";
    case "connection-failed":
      return "bg-[#FBDAE3]";
    case "inactive":
      return "bg-[#EBE6FB]";
    default:
      return "bg-gray-100";
  }
};

export const getServerStatusText = (status: string) => {
  switch (status) {
    case "connecting":
      return "Connecting...";
    case "connected":
      return "Active";
    case "pending-auth":
      return "Pending Authentication";
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
