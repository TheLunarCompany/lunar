import type {
  EnvRefClientCredentials,
  EnvRefClientId,
  LiteralClientCredentials,
  LiteralClientId,
} from "@mcpx/shared-model";

type ClientIdCredentials = LiteralClientId | EnvRefClientId;
type ClientCredentials = LiteralClientCredentials | EnvRefClientCredentials;

// Returns the client ID value, resolving from process.env if needed.
export function resolveClientId(
  credentials: ClientIdCredentials,
): string | undefined {
  if (isLiteralCredentials(credentials)) return credentials.clientId;
  return process.env[credentials.clientIdEnv];
}

// Returns both credentials, resolving from process.env if needed.
// Returns undefined if any env var is missing.
export function resolveClientCredentials(
  credentials: ClientCredentials,
): { clientId: string; clientSecret: string } | undefined {
  if (isLiteralCredentials(credentials)) {
    return {
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
    };
  }
  const clientId = process.env[credentials.clientIdEnv];
  const clientSecret = process.env[credentials.clientSecretEnv];
  if (!clientId || !clientSecret) return undefined;
  return { clientId, clientSecret };
}

// Type guard to check if credentials are literal values or env var references.
export function isLiteralCredentials(
  credentials: ClientCredentials | ClientIdCredentials,
): credentials is LiteralClientCredentials | LiteralClientId {
  return "clientId" in credentials;
}
