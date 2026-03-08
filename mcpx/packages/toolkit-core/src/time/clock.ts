// Production
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

// Test
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
