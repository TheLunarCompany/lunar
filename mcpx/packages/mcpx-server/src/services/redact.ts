// helper to remove env from logged objects
export function redactEnv(obj: unknown): Record<string, unknown> {
  if (typeof obj !== "object" || obj === null) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => key !== "env"),
  );
}
