export class AlreadyExistsError extends Error {
  constructor(message = "Resource already exists") {
    super(message);
    this.name = "AlreadyExistsError";
  }
}
export class NotFoundError extends Error {
  constructor(message = "Resource not found") {
    super(message);
    this.name = "NotFoundError";
  }
}
export class NotAllowedError extends Error {
  constructor(message = "Operation not allowed") {
    super(message);
    this.name = "NotAllowedError";
  }
}
export class FailedToConnectToTargetServer extends Error {
  constructor(message = "Failed to connect to target server") {
    super(message);
    this.name = "FailedToConnectToTargetServer";
  }
}
export class InvalidConfigError extends Error {
  constructor(message = "Invalid configuration") {
    super(message);
    this.name = "InvalidConfigError";
  }
}
export class InvalidSchemaError extends Error {
  constructor(message = "Invalid schema") {
    super(message);
    this.name = "InvalidSchemaError";
  }
}

export type MissingEnvVar =
  | { key: string; type: "literal" }
  | { key: string; type: "fromEnv"; fromEnvName: string };

export class PendingInputError extends Error {
  constructor(public readonly missingEnvVars: MissingEnvVar[]) {
    super(
      `Missing environment variables: ${missingEnvVars.map((v) => v.key).join(", ")}`,
    );
    this.name = "PendingInputError";
  }
}

export function isPendingInputError(
  error: unknown,
): error is PendingInputError {
  return error instanceof PendingInputError;
}
