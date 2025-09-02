export type LLM =
  | {
      provider: string;
      model: string;
    }
  | {
      provider?: string;
      modelId?: string;
    };

export type Usage = {
  callCount: number;
  lastCalledAt?: Date | string | number | null;
};

export type Agent = {
  id: string;
  identifier: string;
  sessionId: string;
  status: string;
  lastActivity?: Date | string | number | null;
  llm?: LLM;
  usage: Usage;
};
