// Re-invokes an operation that may throw until it succeeds or attempts run out.
// Returns the operation's value on success; rethrows the last error once
// exhausted. Contrast with withPolling, which re-reads a value until a predicate
// holds.
export async function withRetries<T>(props: {
  maxAttempts: number;
  sleepTimeMs: number;
  operation: () => Promise<T>;
  onError?: (error: unknown, attempt: number) => void;
}): Promise<T> {
  const { maxAttempts, sleepTimeMs, operation, onError } = props;

  const attempt = async (n: number): Promise<T> => {
    try {
      return await operation();
    } catch (error) {
      onError?.(error, n);
      if (n >= maxAttempts) {
        throw error;
      }
      if (sleepTimeMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, sleepTimeMs));
      }
      return attempt(n + 1);
    }
  };

  return attempt(1);
}
