import type {
  EnvRefClientCredentials,
  EnvRefClientId,
  LiteralClientCredentials,
  LiteralClientId,
} from "@mcpx/shared-model";
import type { EnvVarResolver } from "../services/env-var-manager.js";

type ClientIdCredentials = LiteralClientId | EnvRefClientId;
type ClientCredentials = LiteralClientCredentials | EnvRefClientCredentials;

// Returns the client ID value, resolving env-var refs via the resolver
// (which checks the hub-pushed snapshot then falls back to process.env).
export function resolveClientId(
  credentials: ClientIdCredentials,
  envVars: EnvVarResolver,
): string | undefined {
  if (isLiteralCredentials(credentials)) return credentials.clientId;
  return envVars.resolve(credentials.clientIdEnv);
}

// Returns both credentials, resolving env-var refs via the resolver.
// Returns undefined if any referenced env var is missing.
export function resolveClientCredentials(
  credentials: ClientCredentials,
  envVars: EnvVarResolver,
): { clientId: string; clientSecret: string } | undefined {
  if (isLiteralCredentials(credentials)) {
    return {
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
    };
  }
  const clientId = envVars.resolve(credentials.clientIdEnv);
  const clientSecret = envVars.resolve(credentials.clientSecretEnv);
  if (!clientId || !clientSecret) return undefined;
  return { clientId, clientSecret };
}

// Type guard to check if credentials are literal values or env var references.
export function isLiteralCredentials(
  credentials: ClientCredentials | ClientIdCredentials,
): credentials is LiteralClientCredentials | LiteralClientId {
  return "clientId" in credentials;
}
