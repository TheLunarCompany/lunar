export interface ThrottledSenderOptions {
  debounceMs?: number;
  maxWaitMs?: number;
}

/**
 * A throttled sender that delays and deduplicates messages by key.
 * - Each message is delayed by debounceMs (default 1000ms)
 * - If multiple messages with the same key arrive during the delay, only the latest is sent
 * - To prevent starvation, messages are guaranteed to send within maxWaitMs of the first attempt
 */
export class ThrottledSender {
  private readonly pendingMessages = new Map<
    string,
    {
      payload: unknown;
      debounceTimeout: NodeJS.Timeout;
      maxTimeout: NodeJS.Timeout;
    }
  >();
  private readonly debounceMs: number;
  private readonly maxWaitMs: number;

  constructor(
    private readonly sender: (key: string, payload: unknown) => void,
    options: ThrottledSenderOptions = {},
  ) {
    this.debounceMs = options.debounceMs ?? 1000;
    this.maxWaitMs = options.maxWaitMs ?? 1000;
  }

  send(key: string, payload: unknown): void {
    const existing = this.pendingMessages.get(key);

    if (existing) {
      // Update the payload to the latest
      existing.payload = payload;

      // Clear and reset the debounce timer
      clearTimeout(existing.debounceTimeout);
      existing.debounceTimeout = setTimeout(() => {
        this.flush(key);
      }, this.debounceMs);

      // Keep the existing max timeout as is
    } else {
      // First message for this key - set up both timers
      const debounceTimeout = setTimeout(() => {
        this.flush(key);
      }, this.debounceMs);

      const maxTimeout = setTimeout(() => {
        this.flush(key);
      }, this.maxWaitMs);

      this.pendingMessages.set(key, {
        payload,
        debounceTimeout,
        maxTimeout,
      });
    }
  }

  shutdown(): void {
    // Flush all pending messages
    for (const key of Array.from(this.pendingMessages.keys())) {
      this.flush(key);
    }
    this.pendingMessages.clear();
  }

  private flush(key: string): void {
    const pending = this.pendingMessages.get(key);
    if (!pending) return;

    // Clear both timeouts
    clearTimeout(pending.debounceTimeout);
    clearTimeout(pending.maxTimeout);

    // Remove from pending
    this.pendingMessages.delete(key);

    // Send the message
    this.sender(key, pending.payload);
  }
}
