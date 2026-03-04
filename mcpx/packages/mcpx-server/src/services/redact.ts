// helper to remove env from logged objects
export function redactEnv(obj: unknown): Record<string, unknown> {
  const rec = (obj ?? {}) as Record<string, unknown>;
  const copy: Record<string, unknown> = { ...rec };
  if (Object.prototype.hasOwnProperty.call(copy, "env")) {
    delete (copy as { env?: unknown }).env;
  }
  return copy;
}
