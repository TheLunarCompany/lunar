import { useStrictness } from "./strictness";

export function usePermissions() {
  const { data: strictness } = useStrictness();

  if (!strictness) {
    // if undefined, assume strict
    return {
      canAddCustomServerAndEdit: false,
    };
  }

  if (!strictness.strictnessFeatureEnabled) {
    // no strictness enabled in the system, everyone can edit and add custom
    return {
      canAddCustomServerAndEdit: true,
    };
  }

  // we know strictness in enabled, infer permissions directly from it,
  // cause it already included both mode check and admin override check includes both
  const canAddCustomServerAndEdit = !strictness.isStrict;
  return { canAddCustomServerAndEdit };
}
