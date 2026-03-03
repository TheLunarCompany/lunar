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
