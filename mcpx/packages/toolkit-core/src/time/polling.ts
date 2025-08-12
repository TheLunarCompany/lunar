export const PollingExhaustedError = new Error("Polling exhausted");

export async function withAsyncPolling<T, S extends T>(props: {
  maxAttempts: number;
  sleepTimeMs: number;
  getValue: () => Promise<T>;
  found: (value: T) => value is S;
}): Promise<S> {
  const { maxAttempts, sleepTimeMs, getValue, found } = props;
  let attempts = 0;

  let value: T;
  while (attempts < maxAttempts) {
    value = await getValue();
    if (found(value)) {
      return value;
    }

    attempts++;
    if (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, sleepTimeMs));
    }
  }
  return Promise.reject(PollingExhaustedError);
}

export async function withPolling<T, S extends T>(props: {
  maxAttempts: number;
  sleepTimeMs: number;
  getValue: () => T;
  found: (value: T) => value is S;
}): Promise<S> {
  return withAsyncPolling({
    ...props,
    getValue: async () => props.getValue(),
  });
}
