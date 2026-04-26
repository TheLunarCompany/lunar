import React from "react";
import { CursorInstructions } from "./CursorInstructions";
import {
  ClaudeDesktopInstructions,
  ClaudeCodeInstructions,
} from "./ClaudeInstructions";
import { WindsurfInstructions } from "./WindsurfInstructions";
import { CustomInstructions } from "./CustomInstructions";
import { VSCodeInstructions } from "./VSCodeInstructions";
import { CopilotInstructions } from "./CopilotInstructions";
import { ChatGPTInstructions } from "./ChatGPTInstructions";
import { N8nWorkflowInstructions } from "./N8nWorkflowInstructions";

interface AgentInstructionsProps {
  agentType: string;
}

export const AgentInstructions: React.FC<AgentInstructionsProps> = ({
  agentType,
}) => {
  switch (agentType) {
    case "cursor":
      return <CursorInstructions />;
    case "claudeDesktop":
      return <ClaudeDesktopInstructions />;
    case "ClaudeCode":
      return <ClaudeCodeInstructions />;
    case "windsurf":
      return <WindsurfInstructions />;
    case "vscode":
      return <VSCodeInstructions />;
    case "copilot":
      return <CopilotInstructions />;
    case "openai-mcp":
      return <ChatGPTInstructions />;
    case "n8n":
      return <N8nWorkflowInstructions />;
    case "custom":
      return <CustomInstructions />;
    default:
      return null;
  }
};
