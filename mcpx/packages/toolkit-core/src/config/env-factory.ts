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
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) =>
        (nonSecretKeys as readonly (keyof T)[]).includes(k)
          ? [k, v]
          : [k, "***REDACTED***"]
      )
    ) as T;
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
