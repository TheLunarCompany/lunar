const BASE_DELAY_MS = 1_000;
const RANDOMIZATION_FACTOR = 0.5;

// Exponential backoff with jitter for re-arming the Hub connection. The caller
// passes the cap per attempt, so handshake failures can back off further than
// plain connect errors. `reset()` is for a completed handshake only.
export class ReArmBackoff {
  private attempts = 0;

  constructor(private readonly random: () => number = Math.random) {}

  next(params: { capMs: number }): number {
    const { capMs } = params;
    const base = Math.min(BASE_DELAY_MS * 2 ** this.attempts, capMs);
    const jitter = base * RANDOMIZATION_FACTOR * (this.random() * 2 - 1);
    this.attempts++;
    // Clamp after jitter so the delay never exceeds the cap.
    return Math.min(capMs, Math.max(0, Math.round(base + jitter)));
  }

  reset(): void {
    this.attempts = 0;
  }

  get attemptCount(): number {
    return this.attempts;
  }
}
