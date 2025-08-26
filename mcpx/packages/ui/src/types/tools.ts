export type ToolDetails = {
  description: string;
  name: string;
  originalToolName?: string;
  serviceName: string;
  params?: Array<{
    description: string;
    name: string;
    type: string;
  }>;
  overrideParams?: Record<string, any>;
};

export type ToolsItem = {
  description?: {
    text: string;
    action: "append" | "rewrite";
  };
  name: string;
  originalToolId?: string;
  originalToolName?: string;
  serviceName: string;
  overrideParams?: Record<string, any>;
};
