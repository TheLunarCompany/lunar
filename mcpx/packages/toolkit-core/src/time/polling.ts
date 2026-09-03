export class PollingExhaustedError extends Error {
  constructor() {
    super("Polling exhausted");
    this.name = "PollingExhaustedError";
  }
}

export class PollingAbortedError extends Error {
  constructor() {
    super("Polling aborted");
    this.name = "PollingAbortedError";
  }
}

export async function withAsyncPolling<T, S extends T>(props: {
  maxAttempts: number;
  sleepTimeMs: number;
  // Receives the 0-based attempt number; callbacks may ignore it.
  getValue: (attempt: number) => Promise<T>;
  found: (value: T) => value is S;
  signal?: AbortSignal;
}): Promise<S> {
  const { maxAttempts, sleepTimeMs, getValue, found, signal } = props;
  let attempts = 0;

  let value: T;
  while (attempts < maxAttempts) {
    if (signal?.aborted) {
      return Promise.reject(new PollingAbortedError());
    }

    value = await getValue(attempts);
    if (found(value)) {
      return value;
    }

    attempts++;
    if (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, sleepTimeMs));
    }
  }
  return Promise.reject(new PollingExhaustedError());
}

export async function withPolling<T, S extends T>(props: {
  maxAttempts: number;
  sleepTimeMs: number;
  getValue: (attempt: number) => T;
  found: (value: T) => value is S;
  signal?: AbortSignal;
}): Promise<S> {
  return withAsyncPolling({
    ...props,
    getValue: async (attempt) => props.getValue(attempt),
  });
}
