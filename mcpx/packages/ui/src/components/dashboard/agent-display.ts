import { Agent } from "@/types";
import { getAgentType } from "./helpers";
import { agentsData } from "./constants";

export interface AgentDisplay {
  // Primary label on the box / drawer header.
  title: string;
  // Optional second line. Tag clusters show the underlying client (with +N if many).
  // ClientName + Anonymous clusters skip it — the title already conveys identity.
  // `allPrettified` carries every underlying client's prettified name (drawer hover list).
  subtitle?: {
    primary: string;
    extraCount: number;
    allPrettified: string[];
  };
  icon: { src: string; alt: string };
}

export function prettifiedAgentName(rawName: string): string {
  const data = agentsData[getAgentType(rawName) ?? "DEFAULT"];
  return data.name === "Default" ? rawName : data.name;
}

export function iconForAgentName(rawName: string): {
  src: string;
  alt: string;
} {
  const data = agentsData[getAgentType(rawName) ?? "DEFAULT"];
  return { src: data.icon, alt: `${data.name} Agent Avatar` };
}

export function deriveAgentDisplay(agent: Agent): AgentDisplay {
  switch (agent.identityType) {
    case "consumerTag": {
      const [firstClient, ...restClients] = agent.clientNames;
      return {
        title: agent.consumerTag,
        subtitle: firstClient
          ? {
              primary: prettifiedAgentName(firstClient),
              extraCount: restClients.length,
              allPrettified: agent.clientNames.map(prettifiedAgentName),
            }
          : undefined,
        icon: iconForAgentName(firstClient ?? agent.consumerTag),
      };
    }
    case "clientName":
      return {
        title: prettifiedAgentName(agent.clientName),
        icon: iconForAgentName(agent.clientName),
      };
    case "anonymous": {
      const data = agentsData.DEFAULT;
      return {
        title: "Anonymous",
        icon: { src: data.icon, alt: "Anonymous Agent Avatar" },
      };
    }
  }
}
