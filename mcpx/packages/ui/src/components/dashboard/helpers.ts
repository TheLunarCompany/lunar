import { AGENT_TYPES } from "./constants";
import { AgentType } from "./types";

export const getAgentType = (agentIdentifier?: string): AgentType | null => {
  if (!agentIdentifier) return null;

  const lowerIdentifier = agentIdentifier.toLowerCase();

   const result = Object.keys(AGENT_TYPES).find(type => {
    return lowerIdentifier.includes(AGENT_TYPES[type as AgentType])
  }) as AgentType | null;

  return result;
};