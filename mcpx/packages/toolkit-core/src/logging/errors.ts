import { makeError } from "../data/errors.js";

export interface LoggableError {
  errorName: string;
  errorMessage: string;
  errorStack?: string;
}

export function loggableError(e: unknown): LoggableError {
  const error = makeError(e);
  return {
    errorName: error.name,
    errorMessage: error.message,
    errorStack: error.stack,
  };
}

const MAX_BODY_PREVIEW_LENGTH = 512;

export interface LoggableHttpErrorInput {
  status: number;
  /** Reduced to a bounded `bodyPreview`; never logged raw. Omit for secrets. */
  body?: unknown;
  /** Extra non-sensitive context (e.g. setupOwnerId). */
  [key: string]: unknown;
}

/**
 * Shapes an HTTP response for logging without leaking the raw body: always
 * emits a bounded `bodyPreview`, never `body`. Spread into log metadata:
 *   logger.error("...", { ...loggableHttpError({ status, body, setupOwnerId }) })
 */
export function loggableHttpError({
  status,
  body,
  ...context
}: LoggableHttpErrorInput): Record<string, unknown> {
  return {
    ...context,
    status,
    bodyPreview: previewBody(body),
  };
}

function previewBody(body: unknown): string {
  if (body === undefined || body === null) {
    return "";
  }
  const serialized = typeof body === "string" ? body : safeJsonStringify(body);
  if (serialized.length <= MAX_BODY_PREVIEW_LENGTH) {
    return serialized;
  }
  const omitted = serialized.length - MAX_BODY_PREVIEW_LENGTH;
  return `${serialized.slice(0, MAX_BODY_PREVIEW_LENGTH)}… [truncated ${omitted} chars]`;
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return "[unserializable]";
  }
}
