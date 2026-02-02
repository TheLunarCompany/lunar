import { Logger } from "winston";
import { SetIdentityPayload } from "@mcpx/webapp-protocol/messages";
import { Identity as ApiFormatIdentity } from "@mcpx/shared-model";

// Identity is a discriminated union: Personal or Enterprise
// Enterprise entity type is derived from protocol's SetIdentityPayload

export interface PersonalIdentity {
  mode: "personal";
}

export interface EnterpriseIdentity {
  mode: "enterprise";
  entity: SetIdentityPayload;
}

export type Identity = PersonalIdentity | EnterpriseIdentity;

export interface IdentityServiceI {
  getIdentity(): Identity;
  setIdentity(payload: SetIdentityPayload): void;
  isSpace(): boolean;
  isAdmin(): boolean;
  hasAdminPrivileges(): boolean;
  isStrictPermissionsEnabled(): boolean;
}

// Default enterprise identity before hub sends info: user with member role (most restrictive)
const DEFAULT_ENTERPRISE_ENTITY: SetIdentityPayload = {
  entityType: "user",
  role: "member",
};

export class IdentityService implements IdentityServiceI {
  private identity: Identity;
  private logger: Logger;
  private enableStrictPermissions: boolean;

  constructor(
    logger: Logger,
    config: { isEnterprise: boolean; isPermissionsStrict: boolean },
  ) {
    this.logger = logger.child({ component: "IdentityService" });

    this.identity = config.isEnterprise
      ? { mode: "enterprise", entity: DEFAULT_ENTERPRISE_ENTITY }
      : { mode: "personal" };

    this.enableStrictPermissions = config.isPermissionsStrict;
    this.logger.info("Identity service initialized", {
      mode: this.identity.mode,
      permissions: this.enableStrictPermissions,
    });
  }

  getIdentity(): Identity {
    return this.identity;
  }

  setIdentity(payload: SetIdentityPayload): void {
    if (this.identity.mode === "personal") {
      this.logger.warn(
        "Ignoring set-identity in personal mode - identity is fixed",
      );
      return;
    }

    this.identity = {
      mode: "enterprise",
      entity: payload,
    };

    this.logger.info("Identity updated from hub", {
      entityType: payload.entityType,
      role: payload.entityType === "user" ? payload.role : undefined,
    });
  }

  isSpace(): boolean {
    return isSpace(this.identity);
  }

  isAdmin(): boolean {
    return isAdmin(this.identity);
  }

  isStrictPermissionsEnabled(): boolean {
    return this.enableStrictPermissions;
  }

  hasAdminPrivileges(): boolean {
    if (this.isAdmin()) {
      return true;
    }
    if (!this.enableStrictPermissions) {
      return true;
    }
    return false;
  }

  getIdentityForAPI(): ApiFormatIdentity {
    const identity = this.getIdentity();
    if (identity.mode === "personal") {
      this.logger.info("getIdentityForAPI() called - personal mode", {
        mode: "personal",
      });
      return identity;
    }
    // in enterprise mode, add privileges

    const result = {
      ...identity,
      privileges: {
        hasAdminPrivileges: this.hasAdminPrivileges(),
        isAdmin: this.isAdmin(),
      },
    };
    this.logger.info("getIdentityForAPI() called - enterprise mode", {
      mode: "enterprise",
      identity: result,
    });
    return result;
  }
}

export function isAdmin(identity: Identity): boolean {
  if (identity.mode === "personal") {
    return false;
  }
  if (identity.entity.entityType === "space") {
    return false;
  }
  return identity.entity.role === "admin";
}

export function isSpace(identity: Identity): boolean {
  if (identity.mode === "personal") {
    return false;
  }
  return identity.entity.entityType === "space";
}
