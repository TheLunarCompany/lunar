import type { CredentialField } from "@mcpx/shared-model";
import type { EnvVarResolver } from "../services/env-var-manager.js";

// Resolves a single credential field. envRef fields are looked up via
// the resolver (hub-pushed snapshot, falling back to process.env);
// returns undefined when the referenced env var is missing.
function resolveField(
  field: CredentialField,
  envVars: EnvVarResolver,
): string | undefined {
  return field.type === "literal"
    ? field.value
    : envVars.resolve(field.envName);
}

export function resolveClientId(
  credentials: { clientId: CredentialField },
  envVars: EnvVarResolver,
): string | undefined {
  return resolveField(credentials.clientId, envVars);
}

export function resolveClientCredentials(
  credentials: { clientId: CredentialField; clientSecret: CredentialField },
  envVars: EnvVarResolver,
): { clientId: string; clientSecret: string } | undefined {
  const clientId = resolveField(credentials.clientId, envVars);
  const clientSecret = resolveField(credentials.clientSecret, envVars);
  if (!clientId || !clientSecret) return undefined;
  return { clientId, clientSecret };
}
