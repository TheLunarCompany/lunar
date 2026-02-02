import { useIdentity, isAdminIdentity, isEnterpriseIdentity } from "./identity";
import { useStrictness } from "./strictness";

export function usePermissions() {
  const { data: identity } = useIdentity();
  const { data: strictness } = useStrictness();

  const isEnterprise = identity
    ? isEnterpriseIdentity(identity.identity)
    : false;
  const isAdmin = identity ? isAdminIdentity(identity.identity) : false;
  const isStrict = strictness?.isStrict ?? true;
  const canAddCustomServer = !isEnterprise || (isAdmin && !isStrict);

  return { isEnterprise, isAdmin, isStrict, canAddCustomServer };
}
