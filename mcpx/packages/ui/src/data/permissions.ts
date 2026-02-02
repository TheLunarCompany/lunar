import {
  useIdentity,
  isAdminIdentity,
  hasAdminPrivileges,
  isEnterpriseIdentity,
} from "./identity";
import { useStrictness } from "./strictness";

export function usePermissions() {
  const { data: identity } = useIdentity();
  const { data: strictness } = useStrictness();

  const isEnterprise = identity
    ? isEnterpriseIdentity(identity.identity)
    : false;
  const isAdmin = identity ? isAdminIdentity(identity.identity) : false;
  const hasPrivileges = identity
    ? hasAdminPrivileges(identity.identity)
    : false; // Privileges (admin or feature flag)

  const isStrict = strictness?.isStrict ?? true;
  const canAddCustomServer = !isEnterprise || (hasPrivileges && !isStrict);

  return { isEnterprise, isAdmin, hasPrivileges, isStrict, canAddCustomServer };
}
