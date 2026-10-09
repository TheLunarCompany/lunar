import type {
  ConnectedClientCluster,
  ConnectionState,
  VisibleTool,
} from "@mcpx/shared-model";

// Display string derived from a cluster's identity. Anonymous clusters use a sentinel.
export function clusterDisplayName(cluster: ConnectedClientCluster): string {
  switch (cluster.identityType) {
    case "consumerTag":
      return cluster.consumerTag;
    case "clientName":
      return cluster.clientName;
    case "anonymous":
      return "anonymous";
  }
}

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

type AgentBase = {
  id: string;
  // Display label — e.g. consumerTag for tag clusters, prettified clientName for client clusters.
  // Switch on `identityType` for permission routing; `identifier` is for visuals only.
  identifier: string;
  sessionIds: string[];
  status: string;
  lastActivity?: Date | string | number | null;
  llm?: LLM;
  usage: Usage;
  dynamicMode: boolean;
  visibleTools: VisibleTool[];
  connectionState: ConnectionState;
};

// Mirrors ConnectedClientCluster's discriminator. `clientNames` on tag clusters
// powers the +N badge in the graph and the "Connected clients" list in the drawer.
export type Agent = AgentBase &
  (
    | {
        identityType: "consumerTag";
        consumerTag: string;
        clientNames: string[];
      }
    | { identityType: "clientName"; clientName: string }
    | { identityType: "anonymous" }
  );
