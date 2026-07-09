import { EnabledSkills, Skill } from "@mcpx/shared-model";
import { Logger } from "winston";
import { env } from "../../env.js";
import { CapabilityRegistry } from "../capability-registry.js";
import { InternalCapabilitiesService } from "../internal-capabilities-service.js";
import { HubSocketAdapter } from "../saved-setups-client.js";
import { HubSkillClient } from "./hub-skill-client.js";
import {
  noOpSkillResourceProjector,
  SkillResourceProjector,
  SkillResourceProjectorI,
} from "./skill-resource-projector.js";
import { SkillScope } from "./skill-scope.js";
import { SkillStore } from "./skill-store.js";

export interface SkillServices {
  store: SkillStore;
  scope: SkillScope;
  projector: SkillResourceProjectorI;
}

export interface SkillServicesDeps {
  getSocketAdapter: () => HubSocketAdapter | null;
  getEnabledSkills: () => EnabledSkills[];
  getCatalogItemId: (serverName: string) => string | undefined;
  capabilityRegistry: CapabilityRegistry;
  internalCapabilities: InternalCapabilitiesService;
}

export function buildSkillServices(
  deps: SkillServicesDeps,
  logger: Logger,
): SkillServices {
  const store = new SkillStore(
    logger,
    new HubSkillClient(deps.getSocketAdapter, logger),
  );
  const scope = new SkillScope(
    {
      getEnabledSkills: deps.getEnabledSkills,
      getSkills: (): Skill[] => store.getCatalog().mine,
      getCatalogItemId: deps.getCatalogItemId,
    },
    logger,
  );
  return {
    store,
    scope,
    projector: buildProjector({ store, scope, deps }, logger),
  };
}

// Skills reach consumers only in scoping mode; otherwise the projector is
// inert. The kind flags govern upstream serving and play no part here.
function buildProjector(
  props: {
    store: SkillStore;
    scope: SkillScope;
    deps: SkillServicesDeps;
  },
  logger: Logger,
): SkillResourceProjectorI {
  const { store, scope, deps } = props;
  if (!env.ENABLE_SKILL_SCOPING) {
    return noOpSkillResourceProjector;
  }
  return new SkillResourceProjector(
    {
      skillStore: store,
      capabilityRegistry: deps.capabilityRegistry,
      internalCapabilities: deps.internalCapabilities,
      isSkillVisible: (consumer, skillId): boolean =>
        scope.isEnabled(consumer, skillId),
    },
    logger,
  );
}
