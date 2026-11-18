import { AsyncLocalStorage } from "node:async_hooks";

export type LogContext = Readonly<Record<string, string>>;

// Carries ambient log fields (request id, and whatever a product adds, such as
// a tenant) across the whole async chain of a request, so the logger can stamp
// them on every line without call sites passing them around.
const storage = new AsyncLocalStorage<LogContext>();

export function runWithLogContext<T>(fields: LogContext, fn: () => T): T {
  return storage.run({ ...storage.getStore(), ...fields }, fn);
}

export function currentLogContext(): LogContext {
  return storage.getStore() ?? {};
}

export function runWithRequestId<T>(requestId: string, fn: () => T): T {
  return runWithLogContext({ requestId }, fn);
}

export function currentRequestId(): string | undefined {
  return currentLogContext()["requestId"];
}
