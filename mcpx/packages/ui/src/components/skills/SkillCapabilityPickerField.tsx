import { useController, type Control } from "react-hook-form";

import type { CapabilityProvider } from "@/components/capabilities/types";
import {
  buildSkillCapabilitySelectionKey,
  splitSkillCapabilitySelectionKey,
  type SkillCapabilitySelectionKey,
} from "@/mapping/skill-capabilities";
import { SkillCapabilityPicker } from "./SkillCapabilityPicker";
import {
  sortSkillCapabilityKeys,
  type SkillCapabilityFormValues,
} from "./skill-capability-form-schema";

type SkillCapabilityPickerFieldProps = {
  control: Control<SkillCapabilityFormValues>;
  name: "capabilities";
  providers: CapabilityProvider[];
  unavailableProviderNames?: Set<string>;
  unavailableProviderDescriptions?: Map<string, string>;
  providerFilters?: string[];
  onProviderFiltersChange?: (providerNames: string[]) => void;
};

export function SkillCapabilityPickerField({
  control,
  name,
  providers,
  unavailableProviderNames,
  unavailableProviderDescriptions,
  providerFilters,
  onProviderFiltersChange,
}: SkillCapabilityPickerFieldProps) {
  const { field } = useController({ control, name });
  const selectedKeys = new Set(field.value.selectedKeys);

  return (
    <SkillCapabilityPicker
      providers={providers}
      selectedKeys={selectedKeys}
      unavailableProviderNames={unavailableProviderNames}
      unavailableProviderDescriptions={unavailableProviderDescriptions}
      providerFilters={providerFilters}
      onProviderFiltersChange={onProviderFiltersChange}
      onSelectedKeysChange={(nextSelectedKeys, changedKey) => {
        const nextKeys = withoutSiblingWildcard(nextSelectedKeys, changedKey);

        field.onChange({
          ...field.value,
          selectedKeys: sortSkillCapabilityKeys(nextKeys),
        });
      }}
    />
  );
}

function withoutSiblingWildcard(
  selectedKeys: Set<SkillCapabilitySelectionKey>,
  changedKey: SkillCapabilitySelectionKey,
) {
  const nextKeys = new Set(selectedKeys);
  const { catalogItemId, kind, itemName } =
    splitSkillCapabilitySelectionKey(changedKey);

  if (itemName !== "*") {
    nextKeys.delete(buildSkillCapabilitySelectionKey(catalogItemId, kind, "*"));
  }

  return nextKeys;
}
