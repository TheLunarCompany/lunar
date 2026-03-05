import { EnvRequirements, EnvValue } from "@mcpx/shared-model";

/**
 * Resolves env requirements from a catalog template with user-provided values
 * to create runtime env config.
 *
 * Resolution rules:
 * - fixed: always use catalog's prefilled value (user cannot override)
 * - required: user must provide value (no fallback to prefilled)
 * - optional: use user value if provided, otherwise skip
 *
 * Note: prefilled is only a UI hint for required/optional. The UI shows it
 * as a default, and the user sends back the actual value they want.
 */
export function resolveEnvToRuntime(
  requirements: EnvRequirements | undefined,
  userValues: Record<string, EnvValue>,
): Record<string, EnvValue> {
  if (!requirements) {
    return {};
  }

  const result: Record<string, string | { fromEnv: string } | null> = {};
  const missingRequired: string[] = [];

  for (const [key, requirement] of Object.entries(requirements)) {
    const userValue = userValues[key];

    if (requirement.kind === "fixed") {
      // Fixed: enforce catalog value, ignore user input
      result[key] = requirement.prefilled;
    } else if (userValue !== undefined) {
      // User provided a value
      result[key] = userValue;
    } else if (requirement.kind === "required") {
      // Required but user didn't provide value
      missingRequired.push(key);
    }
    // Optional without user value: skip
  }

  if (missingRequired.length > 0) {
    throw new MissingRequiredEnvError(missingRequired);
  }

  return result;
}

export class MissingRequiredEnvError extends Error {
  constructor(public readonly missingKeys: string[]) {
    super(`Missing required environment variables: ${missingKeys.join(", ")}`);
    this.name = "MissingRequiredEnvError";
  }
}
