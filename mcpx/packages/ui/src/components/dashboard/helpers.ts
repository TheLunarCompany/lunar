import { AGENT_TYPES } from "./constants";
import { AgentType } from "./types";

export const getAgentType = (agentIdentifier?: string): AgentType | null => {
  if (!agentIdentifier) return null;

  const lowerIdentifier = agentIdentifier.toLowerCase();

  const result = Object.keys(AGENT_TYPES).find((type) => {
    return lowerIdentifier.includes(AGENT_TYPES[type as AgentType]);
  }) as AgentType | null;

  return result;
};

export const getStatusTextColor = (status: string) => {
  switch (status) {
    case "connected_running":
      return "text-[#00B271]";
    case "connected_stopped":
      return "text-[#00B271]";
    case "pending_auth":
      return "text-[#FF9500]";
    case "connection_failed":
      return "text-red-600";
    default:
      return "text-gray-600";
  }
};

export const getStatusBackgroundColor = (status: string) => {
  switch (status) {
    case "connected_running":
      return "bg-[#00B2711A]";
    case "connected_stopped":
      return "bg-[#00B2711A]";
    case "pending_auth":
      return "bg-[#FF95001A]";
    case "connection_failed":
      return "bg-red-100";
    default:
      return "bg-gray-100";
  }
};

export const getStatusText = (status: string) => {
  switch (status) {
    case "connected_running":
      return "ACTIVE";
    case "connected_stopped":
      return "Connected";
    case "pending_auth":
      return "Pending Authentication";
    case "connection_failed":
      return "Connection Error";
    default:
      return "UNKNOWN";
  }
};

export const getServerStatusTextColor = (status: string) => {
  switch (status) {
    case "connected":
      return "text-[#00B271]";
    case "pending-auth":
      return "text-[#FF9500]";
    case "connection-failed":
      return "text-red-600";
    default:
      return "text-gray-600";
  }
};

export const getServerStatusBackgroundColor = (status: string) => {
  switch (status) {
    case "connected":
      return "bg-[#00B2711A]";
    case "pending-auth":
      return "bg-[#FF95001A]";
    case "connection-failed":
      return "bg-red-100";
    default:
      return "bg-gray-100";
  }
};

export const getServerStatusText = (status: string) => {
  switch (status) {
    case "connected":
      return "Active";
    case "pending-auth":
      return "Pending Authentication";
    case "connection-failed":
      return "Connection Error";
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
