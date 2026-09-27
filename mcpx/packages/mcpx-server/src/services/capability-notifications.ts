import { loggableError } from "@mcpx/toolkit-core/logging";
import { Logger } from "winston";

// Dispatches each listener defensively so one bad listener can't take the rest
// down. The outer try catches sync throws; the .catch on Promise.resolve catches
// async rejections — together they cover both cases. The Promise.resolve wrap
// also normalizes sync and async listeners into the same dispatch path.
export function safeEmit<L extends (...args: never[]) => unknown>(
  listeners: Iterable<L>,
  invoke: (cb: L) => void | Promise<void>,
  logger: Logger,
  message: string,
  extra: Record<string, unknown> = {},
): void {
  const onError = (e: unknown): void => {
    logger.warn(message, { ...extra, error: loggableError(e) });
  };
  for (const cb of listeners) {
    try {
      Promise.resolve(invoke(cb)).catch(onError);
    } catch (e) {
      onError(e);
    }
  }
}
