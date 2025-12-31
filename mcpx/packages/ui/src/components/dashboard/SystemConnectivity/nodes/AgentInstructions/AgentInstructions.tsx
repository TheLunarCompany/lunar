import React from "react";
import { CursorInstructions } from "./CursorInstructions";
import { ClaudeInstructions } from "./ClaudeInstructions";
import { WindsurfInstructions } from "./WindsurfInstructions";
import { CustomInstructions } from "./CustomInstructions";
import { VSCodeInstructions } from "./VSCodeInstructions";
import { CopilotInstructions } from "./CopilotInstructions";

interface AgentInstructionsProps {
  agentType: string;
}

export const AgentInstructions: React.FC<AgentInstructionsProps> = ({
  agentType,
}) => {
  switch (agentType) {
    case "cursor":
      return <CursorInstructions />;
    case "claude":
      return <ClaudeInstructions />;
    case "windsurf":
      return <WindsurfInstructions />;
    case "vscode":
      return <VSCodeInstructions />;
    case "copilot":
      return <CopilotInstructions />;
    case "custom":
      return <CustomInstructions />;
    default:
      return null;
  }
};
