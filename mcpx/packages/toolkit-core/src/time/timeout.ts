export class TimeoutError extends Error {
  constructor(
    message: string,
    public readonly timeoutMs: number,
  ) {
    super(message);
    this.name = "TimeoutError";
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation?: string,
): Promise<T> {
  const operationDesc = operation ?? "Operation";
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new TimeoutError(
              `${operationDesc} timed out after ${timeoutMs}ms`,
              timeoutMs,
            ),
          ),
        timeoutMs,
      ),
    ),
  ]);
}
