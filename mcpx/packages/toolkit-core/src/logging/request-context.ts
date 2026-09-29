import { AsyncLocalStorage } from "node:async_hooks";

interface RequestContext {
  requestId: string;
}

// Carries the request id across the whole async chain of a request, so the
// logger can stamp it on every line without call sites passing it around.
const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestId<T>(requestId: string, fn: () => T): T {
  return storage.run({ requestId }, fn);
}

export function currentRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}
