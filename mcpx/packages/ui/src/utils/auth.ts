import {
  isEnterpriseEnabled,
  isPermissionsEnabled,
} from "@/config/runtime-config";
import type { AuthUser } from "@/contexts/auth-types";

export enum Role {
  Member = "member",
  Admin = "admin",
  Owner = "owner",
}

export const isAdmin = (user: AuthUser | null): boolean => {
  const enterpriseEnabled = isEnterpriseEnabled();
  const permissionsEnabled = isPermissionsEnabled();
  if (!enterpriseEnabled || !permissionsEnabled) return true;
  if (!user) return false;
  if (user.role) {
    return user.role === Role.Admin;
  }
  return false;
};
