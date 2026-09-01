import type { SkillCapabilityGroup } from "@mcpx/shared-model";

import type { CapabilityProvider } from "@/components/capabilities/types";
import {
  buildSkillCapabilityGroupFromSelection,
  deriveSkillCapabilitySelectionState,
  type SkillCapabilitySelectionKey,
} from "@/mapping/skill-capabilities";

export type SkillCapabilityFormState = {
  selectedKeys: SkillCapabilitySelectionKey[];
};

export type SkillCapabilityFormValues = {
  capabilities: SkillCapabilityFormState;
};

export function skillCapabilityDraftToFormValues(args: {
  capabilityGroup?: SkillCapabilityGroup;
  providers: CapabilityProvider[];
}): SkillCapabilityFormValues {
  const selectionState = deriveSkillCapabilitySelectionState(args);

  return {
    capabilities: {
      selectedKeys: sortSkillCapabilityKeys(selectionState.selectedKeys),
    },
  };
}

export function skillCapabilityFormValuesToGroup(args: {
  values: SkillCapabilityFormValues;
  providers: CapabilityProvider[];
}): SkillCapabilityGroup | undefined {
  return buildSkillCapabilityGroupFromSelection({
    selectedKeys: new Set(args.values.capabilities.selectedKeys),
    providers: args.providers,
  });
}

export function sortSkillCapabilityKeys<T extends string>(
  keys: Iterable<T>,
): T[] {
  return [...keys].sort();
}
