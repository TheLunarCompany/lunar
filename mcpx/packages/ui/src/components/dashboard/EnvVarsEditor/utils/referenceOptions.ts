import type { EnvValue } from "@mcpx/toolkit-ui/src/utils/env-vars-utils";

export type ReferenceMode = "fromEnv" | "fromSecret";

export type ReferenceOption = {
  key: string;
  kind: "secret";
  value: string;
  label: string;
};

export function buildReferenceOptions(
  query: string,
  secrets: string[],
): ReferenceOption[] {
  const normalizedQuery = query.trim();
  const secretOptions = [...new Set(secrets)]
    .filter((secret) =>
      secret.toLowerCase().includes(normalizedQuery.toLowerCase()),
    )
    .sort((left, right) => left.localeCompare(right))
    .map<ReferenceOption>((secret) => ({
      key: `secret:${secret}`,
      kind: "secret",
      value: secret,
      label: secret,
    }));

  if (normalizedQuery === "") {
    return secretOptions;
  }

  return secretOptions;
}

export function resolveReferenceValue(
  input: string,
  secrets: string[],
): {
  mode: ReferenceMode;
  value: Extract<EnvValue, { fromEnv: string } | { fromSecret: string }>;
} {
  const exactSecret = secrets.find((secret) => secret === input);

  if (exactSecret) {
    return {
      mode: "fromSecret",
      value: { fromSecret: exactSecret },
    };
  }

  return {
    mode: "fromEnv",
    value: { fromEnv: input },
  };
}
