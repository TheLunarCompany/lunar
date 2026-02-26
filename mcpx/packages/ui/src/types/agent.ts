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

// Equivalent to ConnectedClientCluster - might represent multiple connected clients (see session ID)
export type Agent = {
  id: string;
  identifier: string;
  sessionIds: string[];
  status: string;
  lastActivity?: Date | string | number | null;
  llm?: LLM;
  usage: Usage;
};
