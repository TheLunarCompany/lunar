import {
  EnvRequirements,
  HEADER_PARAMS_EXTRACTION_REGEX,
} from "@mcpx/shared-model";
import { Logger } from "winston";
import { MissingEnvVar } from "../errors.js";
import { EnvValue } from "../model/target-servers.js";
import { TargetServerEnvResolver } from "./env-var-manager.js";

export interface ResolveEnvResult {
  resolved: Record<string, string>;
  missingVars: MissingEnvVar[];
}

/**
 * Resolves env, validating empty strings and looking up fromEnv/fromSecret references via the resolver.
 * - null values are tracked as missing or intentionally skipped (user chose "leave empty"), depends on requirements[key]?.kind
 * - Empty/whitespace strings are tracked as missing (type: "literal") or skipped, depends on requirements[key]?.kind
 * - fromEnv/fromSecret references to missing/empty env vars are tracked as missing (type: "fromEnv") - regardless of requirement's kind
 */
export function resolveEnv(props: {
  envConfig: Record<string, EnvValue>;
  envRequirements?: EnvRequirements;
  envVarsResolver: TargetServerEnvResolver;
  logger: Logger;
}): ResolveEnvResult {
  const { envConfig, logger, envRequirements, envVarsResolver } = props;

  const resolved: Record<string, string> = {};
  const missingVars: MissingEnvVar[] = [];
  const allKeys = new Set([
    ...Object.keys(envConfig),
    ...Object.keys(envRequirements ?? {}),
  ]);

  for (const key of allKeys) {
    const requirement = envRequirements?.[key];
    const input =
      requirement?.kind === "fixed"
        ? requirement.prefilled
        : (envConfig[key] ?? null);
    const isRequired = requirement?.kind === "required";
    const resolvedValue = resolveSingleEnvValue(input, envVarsResolver);

    switch (resolvedValue.lookup) {
      case "found":
        resolved[key] = resolvedValue.value;
        break;
      case "not-supplied":
        if (isRequired) {
          logger.warn(
            "Required env variable not supplied, treating as missing",
            { targetEnvKey: key, suppliedValue: input },
          );
          missingVars.push({ key, type: "literal" });
        }
        break;
      case "failed":
        logger.warn(
          "Failed to resolve env variable from environment, treating as missing",
          {
            targetEnvKey: key,
            suppliedValue: input,
            resolvedValue,
          },
        );
        missingVars.push({
          key,
          type: "fromEnv",
          fromEnvName: resolvedValue.missingReference,
        });
        break;
    }
  }

  return { resolved, missingVars };
}

/** Resolves env-backed and params baked header values to concrete strings. Returns resolved headers and any missing vars. */
export function resolveHeadersValues(props: {
  headers: Record<string, EnvValue> | undefined;
  envVarsResolver: TargetServerEnvResolver;
  logger: Logger;
}): ResolveEnvResult {
  const { headers, envVarsResolver, logger } = props;
  if (!headers) return { resolved: {}, missingVars: [] };

  const resolved: Record<string, string> = {};
  const missingVars: MissingEnvVar[] = [];

  for (const [headerName, headerValue] of Object.entries(headers)) {
    if (typeof headerValue === "string") {
      const result = resolveHeaderWithParams(headerValue, envVarsResolver);
      switch (result.lookup) {
        case "found":
          resolved[headerName] = result.value;
          break;
        case "failed":
          logger.warn("Failed to resolve header params, treating as missing", {
            headerName,
            missingParams: result.missingReferences,
          });
          missingVars.push(
            ...result.missingReferences.map((ref) => ({
              key: headerName,
              type: "fromEnv" as const,
              fromEnvName: ref,
            })),
          );
          break;
      }
    } else {
      const result = resolveSingleEnvValue(headerValue, envVarsResolver);
      switch (result.lookup) {
        case "found":
          resolved[headerName] = result.value;
          break;
        case "not-supplied":
          break;
        case "failed":
          logger.warn("Failed to resolve header value, treating as missing", {
            headerName,
            suppliedValue: headerValue,
          });
          missingVars.push({
            key: headerName,
            type: "fromEnv",
            fromEnvName: result.missingReference,
          });
          break;
      }
    }
  }

  return { resolved, missingVars };
}

// ========================
// Single Value resolvers
// ========================

type ResolvedEnvVar =
  | { lookup: "found"; value: string }
  | { lookup: "not-supplied" }
  | { lookup: "failed"; missingReference: string };

type ResolvedHeaderWithParams =
  | { lookup: "found"; value: string }
  | { lookup: "failed"; missingReferences: string[] };

function resolveHeaderWithParams(
  headerValue: string,
  envVarsResolver: TargetServerEnvResolver,
): ResolvedHeaderWithParams {
  const params = [
    ...new Set(
      [...headerValue.matchAll(HEADER_PARAMS_EXTRACTION_REGEX)].reduce<
        string[]
      >(
        (acc, match) => (match[1] !== undefined ? [...acc, match[1]] : acc),
        [],
      ),
    ),
  ];
  const missingReferences: string[] = [];
  let expanded = headerValue;
  for (const param of params) {
    // no op for a string with no params
    const resolved = envVarsResolver.resolveTargetServerEnv(param);
    if (resolved !== undefined && resolved.trim() !== "") {
      expanded = expanded.replaceAll(`{{${param}}}`, resolved);
    } else {
      missingReferences.push(param);
    }
  }
  return missingReferences.length > 0
    ? { lookup: "failed", missingReferences }
    : { lookup: "found", value: expanded };
}

function resolveSingleEnvValue(
  envValue: EnvValue,
  envVars: TargetServerEnvResolver,
): ResolvedEnvVar {
  if (envValue === null) {
    return { lookup: "not-supplied" };
  } else if (typeof envValue === "string") {
    return envValue.trim() === ""
      ? { lookup: "not-supplied" }
      : { lookup: "found", value: envValue };
  } else if ("fromEnv" in envValue) {
    const envVarValue = envVars.resolveTargetServerEnv(envValue.fromEnv);
    return envVarValue !== undefined && envVarValue.trim() !== ""
      ? { lookup: "found", value: envVarValue }
      : { lookup: "failed", missingReference: envValue.fromEnv };
  } else {
    const secretFromEnv = envVars.resolveTargetServerEnv(envValue.fromSecret);
    return secretFromEnv !== undefined && secretFromEnv.trim() !== ""
      ? { lookup: "found", value: secretFromEnv }
      : { lookup: "failed", missingReference: envValue.fromSecret }; // It's still failed if it's selected and not found!!
  }
}
