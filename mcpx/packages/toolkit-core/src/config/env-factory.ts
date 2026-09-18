import { z } from "zod/v4";

/**
 * Build a fully featured env helper set from a Zod schema.
 * @param schema         Zod object that validates your variables.
 * @param nonSecretKeys  Keys that may be logged or surfaced in plain text.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createEnv<S extends z.ZodType<any>>(
  schema: S,
  nonSecretKeys: readonly (keyof z.infer<S>)[]
): {
  env: z.infer<S>;
  getEnv: (vars?: NodeJS.ProcessEnv) => z.infer<S>;
  resetEnv: (vars?: NodeJS.ProcessEnv) => void;
  redactEnv: <T extends Record<string, unknown>>(obj: T) => T;
} {
  type Env = z.infer<S>;
  let cachedEnv: Env;

  /** Parse once, then cache. */
  function getEnv(vars: NodeJS.ProcessEnv = process.env): Env {
    if (!cachedEnv) cachedEnv = schema.parse(vars);
    return cachedEnv;
  }

  /** Re‑parse, useful in tests. */
  function resetEnv(vars: NodeJS.ProcessEnv = process.env): void {
    cachedEnv = schema.parse(vars);
  }

  /** Redact every property except those in nonSecretKeys. */
  function redactEnv<T extends Record<string, unknown>>(obj: T): T {
    return redactExcept(obj, nonSecretKeys as readonly (keyof T)[]);
  }

  /** Proxy so callers can keep writing `env.X` without running getEnv first. */
  const env: Env = new Proxy({} as Env, {
    get(_, prop: string | symbol): unknown {
      return getEnv()[prop as keyof Env];
    },
    ownKeys(): (string | symbol)[] {
      return Reflect.ownKeys(getEnv());
    },
    getOwnPropertyDescriptor(_, prop: string): PropertyDescriptor | undefined {
      return Object.getOwnPropertyDescriptor(getEnv(), prop);
    },
  });

  return { env, getEnv, resetEnv, redactEnv };
}

/** Redact every property of an env-like object except the allow-listed keys. */
export function redactExcept<T extends Record<string, unknown>>(
  obj: T,
  nonSecretKeys: readonly (keyof T)[]
): T {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) =>
      nonSecretKeys.includes(k) ? [k, v] : [k, "***REDACTED***"]
    )
  ) as T;
}

// A group of env vars that only applies when a feature flag is on.
// When enabled, the group parses per its schema (each field as required or
// optional as declared there) and bad config fails boot with the flag named;
// when disabled, the group is undefined and its vars are ignored entirely.
// Consumers narrow once on the group instead of per-field.
// ZodType (not ZodObject) so groups may pipe/transform, e.g. deriving
// values from a raw var while validating it.
export function parseGatedEnvGroup<S extends z.ZodType>(params: {
  enabled: boolean;
  flagName: string;
  schema: S;
  vars?: NodeJS.ProcessEnv;
}): z.infer<S> | undefined {
  const { enabled, flagName, schema, vars = process.env } = params;
  if (!enabled) return undefined;
  const parsed = schema.safeParse(vars);
  if (!parsed.success) {
    throw new Error(
      `${flagName} is enabled but its env vars are invalid: ${z.prettifyError(parsed.error)}`,
    );
  }
  return parsed.data;
}
