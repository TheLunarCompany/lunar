// helper to remove env from logged objects
export function redactEnv(obj: unknown): Record<string, unknown> {
  const rec = (obj ?? {}) as Record<string, unknown>;
  const copy: Record<string, unknown> = { ...rec };
  if (Object.prototype.hasOwnProperty.call(copy, "env")) {
    delete (copy as { env?: unknown }).env;
  }
  return copy;
}

export function redactConfigSecrets<T>(obj: T): T {
  if (!obj || typeof obj !== "object") {
    return obj;
  }
  try {
    const copy = JSON.parse(JSON.stringify(obj));

    function walk(current: any) {
      if (!current || typeof current !== "object") return;
      for (const key of Object.keys(current)) {
        if (key === "clientSecret") {
          if (typeof current[key] === "string") {
            current[key] = "[REDACTED]";
          } else if (
            current[key] &&
            typeof current[key] === "object" &&
            "value" in current[key]
          ) {
            current[key].value = "[REDACTED]";
          }
        } else {
          walk(current[key]);
        }
      }
    }

    walk(copy);
    return copy;
  } catch {
    return obj;
  }
}
