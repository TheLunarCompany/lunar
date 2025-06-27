export type LLM = {
  provider: string;
  model: string;
};

export type Usage = {
  callCount: number;
  lastCalledAt?: string | null;
};

export type Agent = {
  id: string;
  identifier: string;
  sessionId: string;
  status: string;
  lastActivity?: string | null;
  llm?: LLM;
  usage: Usage;
};
