import { ConsumerConfig } from "@mcpx/shared-model";
import { Config } from "../../model/config/config.js";
import { AgentPermissionUpdatedEvent } from "../../model/audit-log-type.js";

function indexToolGroupServers(config: Config): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const group of config.toolGroups) {
    map.set(group.name, new Set(Object.keys(group.services)));
  }
  return map;
}

function referencedServers(
  consumerConfig: ConsumerConfig,
  toolGroupServers: Map<string, Set<string>>,
): Set<string> {
  const groupNames =
    consumerConfig._type === "default-allow"
      ? consumerConfig.block
      : consumerConfig.allow;
  const servers = new Set<string>();
  for (const name of groupNames) {
    const services = toolGroupServers.get(name);
    if (!services) continue;
    for (const s of services) servers.add(s);
  }
  return servers;
}

export function diffConfigForAudit({
  prev,
  next,
}: {
  prev: Config;
  next: Config;
}): AgentPermissionUpdatedEvent[] {
  const events: AgentPermissionUpdatedEvent[] = [];
  const prevGroups = indexToolGroupServers(prev);
  const nextGroups = indexToolGroupServers(next);

  for (const identityType of ["consumers", "clientNames"] as const) {
    const prevEntries = prev.permissions[identityType] ?? {};
    const nextEntries = next.permissions[identityType] ?? {};
    const names = new Set([
      ...Object.keys(prevEntries),
      ...Object.keys(nextEntries),
    ]);

    for (const name of names) {
      const prevEntry = prevEntries[name];
      const nextEntry = nextEntries[name];
      const prevServers = prevEntry
        ? referencedServers(prevEntry, prevGroups)
        : new Set<string>();
      const nextServers = nextEntry
        ? referencedServers(nextEntry, nextGroups)
        : new Set<string>();

      const addedServers = [...nextServers]
        .filter((s) => !prevServers.has(s))
        .sort();
      const removedServers = [...prevServers]
        .filter((s) => !nextServers.has(s))
        .sort();

      if (addedServers.length === 0 && removedServers.length === 0) continue;

      events.push({
        eventType: "agent_permission_updated",
        payload: { name, identityType, addedServers, removedServers },
      });
    }
  }
  return events;
}
