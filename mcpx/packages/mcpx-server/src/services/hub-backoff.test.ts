import { ReArmBackoff } from "./hub-backoff.js";

const HANDSHAKE_CAP_MS = 300_000;
const CONNECT_ERROR_CAP_MS = 10_000;
const NO_JITTER = (): number => 0.5;

describe("ReArmBackoff", () => {
  it("doubles from 1s up to the handshake cap and stays there", () => {
    const backoff = new ReArmBackoff(NO_JITTER);

    const delays = Array.from({ length: 12 }, () =>
      backoff.next({ capMs: HANDSHAKE_CAP_MS }),
    );

    expect(delays).toEqual([
      1_000, 2_000, 4_000, 8_000, 16_000, 32_000, 64_000, 128_000, 256_000,
      300_000, 300_000, 300_000,
    ]);
  });

  it("keeps plain connect errors under the 10s cap", () => {
    const backoff = new ReArmBackoff(NO_JITTER);

    const delays = Array.from({ length: 6 }, () =>
      backoff.next({ capMs: CONNECT_ERROR_CAP_MS }),
    );

    expect(delays).toEqual([1_000, 2_000, 4_000, 8_000, 10_000, 10_000]);
  });

  it("spreads each delay by up to 50% of its base and never exceeds the cap", () => {
    const lowest = new ReArmBackoff(() => 0);
    const highest = new ReArmBackoff(() => 1);

    expect(lowest.next({ capMs: HANDSHAKE_CAP_MS })).toBe(500);
    expect(highest.next({ capMs: HANDSHAKE_CAP_MS })).toBe(1_500);

    const atCap = new ReArmBackoff(() => 1);
    const delays = Array.from({ length: 15 }, () =>
      atCap.next({ capMs: CONNECT_ERROR_CAP_MS }),
    );
    expect(Math.max(...delays)).toBe(CONNECT_ERROR_CAP_MS);
  });

  it("starts over from 1s after reset", () => {
    const backoff = new ReArmBackoff(NO_JITTER);
    backoff.next({ capMs: HANDSHAKE_CAP_MS });
    backoff.next({ capMs: HANDSHAKE_CAP_MS });
    backoff.next({ capMs: HANDSHAKE_CAP_MS });
    expect(backoff.attemptCount).toBe(3);

    backoff.reset();

    expect(backoff.attemptCount).toBe(0);
    expect(backoff.next({ capMs: HANDSHAKE_CAP_MS })).toBe(1_000);
  });
});
