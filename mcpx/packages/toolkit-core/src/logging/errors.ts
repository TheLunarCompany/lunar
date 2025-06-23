import { makeError } from "../data/errors.js";

export interface LoggableError {
  name: string;
  message: string;
  stack?: string;
}

export function loggableError(e: unknown): LoggableError {
  const error = makeError(e);
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
}
