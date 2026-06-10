import { Logger } from "winston";

// Resolves names users can reference in target MCP server env configs
// (via fromEnv/fromSecret in catalog items).
export interface TargetServerEnvResolver {
  resolveTargetServerEnv(name: string): string | undefined;
}

// Adds bulk read for STDIO_INHERIT child env spread.
export interface TargetServerEnvSource extends TargetServerEnvResolver {
  getTargetServerEnv(): Record<string, string>;
}

// Resolves names mcpx's OAuth flow uses to talk to OAuth providers.
// Never reaches target MCP servers. No bulk read — by design.
export interface OauthCredentialResolver {
  resolveOauthCredential(name: string): string | undefined;
}

/**
 * Holds hub-pushed env-var entries in three purpose-scoped buckets:
 *  - profileSecrets: k8s-derived, user-referenceable in catalog config.
 *  - oauthCredentials: admin static OAuth literals, used by mcpx OAuth flow.
 *  - prefilledLiterals: catalog-derived synthetic MCPX_*_PREFILLED entries.
 *
 * Each scoped resolver falls back to process.env.
 * The three scopes don't share a primary map, so a
 * user-controlled profile secret cannot be reached by OAuth-name
 * lookups and vice versa.
 */
export class EnvVarManager
  implements TargetServerEnvSource, OauthCredentialResolver
{
  private profileSecrets = new Map<string, string>();
  private oauthCredentials = new Map<string, string>();
  private prefilledLiterals = new Map<string, string>();
  // Highest applied timestamp per bucket. Used to drop stale snapshots when
  // hub's async resolves complete out of order; tracked independently because
  // the two buckets travel on separate wire events.
  private lastProfileSecretsAt: number | null = null;
  private lastOauthCredentialsAt: number | null = null;
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger.child({ component: "EnvVarManager" });
  }

  // Replaces the profileSecrets bucket if the snapshot is newer than the last
  // applied; otherwise drops it. Returns true when applied.
  applyProfileSecrets(params: {
    entries: Record<string, string>;
    timestamp: number;
  }): boolean {
    const { entries, timestamp } = params;
    if (
      this.lastProfileSecretsAt !== null &&
      timestamp < this.lastProfileSecretsAt
    ) {
      this.logger.debug("Dropping stale set-profile-secrets snapshot", {
        incomingTimestamp: timestamp,
        lastAppliedTimestamp: this.lastProfileSecretsAt,
      });
      return false;
    }
    this.profileSecrets = new Map(Object.entries(entries));
    this.lastProfileSecretsAt = timestamp;
    this.logger.info("Applied set-profile-secrets snapshot", {
      profileSecretCount: this.profileSecrets.size,
      timestamp,
    });
    return true;
  }

  // Replaces the oauthCredentials bucket if the snapshot is newer than the
  // last applied; otherwise drops it. Returns true when applied.
  applyOauthCredentials(params: {
    entries: Record<string, string>;
    timestamp: number;
  }): boolean {
    const { entries, timestamp } = params;
    if (
      this.lastOauthCredentialsAt !== null &&
      timestamp < this.lastOauthCredentialsAt
    ) {
      this.logger.debug("Dropping stale set-oauth-credentials snapshot", {
        incomingTimestamp: timestamp,
        lastAppliedTimestamp: this.lastOauthCredentialsAt,
      });
      return false;
    }
    this.oauthCredentials = new Map(Object.entries(entries));
    this.lastOauthCredentialsAt = timestamp;
    this.logger.info("Applied set-oauth-credentials snapshot", {
      oauthCredentialCount: this.oauthCredentials.size,
      timestamp,
    });
    return true;
  }

  setSecretPrefilledLiterals(entries: Record<string, string>): void {
    this.prefilledLiterals = new Map(Object.entries(entries));
  }

  resolveTargetServerEnv(name: string): string | undefined {
    return (
      this.profileSecrets.get(name) ??
      this.prefilledLiterals.get(name) ??
      process.env[name]
    );
  }

  resolveOauthCredential(name: string): string | undefined {
    return this.oauthCredentials.get(name) ?? process.env[name];
  }

  // Includes prefilledLiterals so target servers can resolve catalog-protected
  // fromEnv refs; excludes oauthCredentials (must never reach target servers).
  getTargetServerEnv(): Record<string, string> {
    return {
      ...Object.fromEntries(this.prefilledLiterals),
      ...Object.fromEntries(this.profileSecrets),
    };
  }

  // Excludes prefilledLiterals — synthetic MCPX_*_PREFILLED keys aren't user-pickable.
  getProfileSecretKeys(): string[] {
    return Array.from(this.profileSecrets.keys());
  }
}
