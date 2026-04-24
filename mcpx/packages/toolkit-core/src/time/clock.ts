// --- Wall clock (what time is it now?) ---
// Production: pass systemClock. Tests: pass new ManualClock() and call advanceBy() to control time.

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

export interface MutableClock extends Clock {
  advanceBy(ms: number): void;
  set(date: Date): void;
}

export class ManualClock implements MutableClock {
  private epochMs: number;

  constructor(startAt: Date = new Date()) {
    this.epochMs = startAt.getTime();
  }

  now(): Date {
    return new Date(this.epochMs);
  }

  advanceBy(ms: number): void {
    this.epochMs += ms;
  }

  set(date: Date): void {
    this.epochMs = date.getTime();
  }
}

// --- Interval clock (scheduling recurring work) ---
// Production: pass systemIntervalClock (wraps global setInterval/clearInterval).
// Tests: pass createManualIntervalClock() and call clock.tick() to fire the registered callback on demand.

export interface IntervalClock {
  setInterval: (fn: () => void, ms: number) => NodeJS.Timeout;
  clearInterval: (id: NodeJS.Timeout) => void;
}

export const systemIntervalClock: IntervalClock = {
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (id) => clearInterval(id),
};

export interface ManualIntervalClock extends IntervalClock {
  // Call the registered callback as if the interval duration had elapsed.
  tick: () => void;
}

export function createManualIntervalClock(): ManualIntervalClock {
  let registeredFn: (() => void) | null = null;
  return {
    setInterval(fn): NodeJS.Timeout {
      registeredFn = fn;
      return 0 as unknown as NodeJS.Timeout;
    },
    clearInterval(): void {
      registeredFn = null;
    },
    tick(): void {
      registeredFn?.();
    },
  };
}
