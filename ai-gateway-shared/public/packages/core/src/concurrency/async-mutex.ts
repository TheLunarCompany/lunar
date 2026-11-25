/**
 * An asynchronous mutex that serializes access to a critical section.
 *
 * Operations are queued and executed one at a time in order.
 * If an operation fails, subsequent operations still proceed (no deadlock).
 *
 * WARNING: NESTED CALLS WILL DEADLOCK!
 * Do NOT call withLock from within a function already holding the lock:
 *
 * ```typescript
 * // THIS WILL DEADLOCK:
 * await mutex.withLock(async () => {
 *   await mutex.withLock(async () => { ... }); // Inner waits for outer, outer waits for inner
 * });
 * ```
 *
 * The inner call queues behind the outer call, but the outer call awaits the inner.
 * This creates a circular wait that hangs forever.
 */
export class AsyncMutex {
  private queue: Promise<void> = Promise.resolve();

  /**
   * Execute a function while holding the lock.
   * Only one function can execute at a time - others wait in queue.
   *
   * @param fn - The async function to execute while holding the lock
   * @returns The result of the function
   * @throws Re-throws any error from fn after releasing the lock
   */
  async withLock<T>(fn: () => Promise<T>): Promise<T> {
    // Definite assignment assertion: TS can't track assignments in async callbacks,
    // but microtask ordering guarantees `release` is assigned before use.
    let release!: () => void;
    const waitForPrevious = this.queue;
    // Chain with .catch to prevent deadlock if previous operation fails
    this.queue = this.queue
      .catch(() => {})
      .then(() => new Promise<void>((r) => (release = r)));

    await waitForPrevious.catch(() => {}); // Swallow errors from previous
    try {
      return await fn();
    } finally {
      release();
    }
  }
}
