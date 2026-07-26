import { describe, expect, it } from "@jest/globals";
import { ManualClock } from "@mcpx/toolkit-core/time";
import { noOpLogger } from "@mcpx/toolkit-core/logging";
import { applyExpiryPolicy, withExpiresAt } from "./token-helpers.js";
import { StoredTokens } from "../services/oauth-token-store.js";

describe("withExpiresAt", () => {
  it("computes expires_at from clock + expires_in", () => {
    const clock = new ManualClock(new Date("2026-01-01T00:00:00Z"));
    const stored = withExpiresAt(
      { access_token: "a", expires_in: 60, token_type: "bearer" },
      clock,
    );
    expect(stored.expires_at).toBe(clock.now().getTime() + 60_000);
    expect(stored.access_token).toBe("a");
  });

  it("does not add expires_at when expires_in is absent", () => {
    const stored = withExpiresAt(
      { access_token: "a", token_type: "bearer" },
      new ManualClock(),
    );
    expect(stored.expires_at).toBeUndefined();
  });
});

describe("applyExpiryPolicy", () => {
  const start = new Date("2026-01-01T00:00:00Z");

  it("returns tokens when not expired", () => {
    const clock = new ManualClock(start);
    const stored: StoredTokens = {
      access_token: "a",
      token_type: "bearer",
      expires_at: clock.now().getTime() + 60_000,
    };
    expect(
      applyExpiryPolicy({
        stored,
        serverName: "srv",
        clock,
        logger: noOpLogger,
      }),
    ).toBe(stored);
  });

  it("returns tokens when no expires_at is set", () => {
    const stored: StoredTokens = { access_token: "a", token_type: "bearer" };
    expect(
      applyExpiryPolicy({
        stored,
        serverName: "srv",
        clock: new ManualClock(start),
        logger: noOpLogger,
      }),
    ).toBe(stored);
  });

  it("returns expired tokens when refresh_token is present so SDK can refresh", () => {
    const clock = new ManualClock(start);
    const stored: StoredTokens = {
      access_token: "a",
      token_type: "bearer",
      expires_at: clock.now().getTime() + 60_000,
      refresh_token: "r",
    };
    clock.advanceBy(120_000);
    expect(
      applyExpiryPolicy({
        stored,
        serverName: "srv",
        clock,
        logger: noOpLogger,
      }),
    ).toBe(stored);
  });

  it("returns undefined when expired and no refresh_token", () => {
    const clock = new ManualClock(start);
    const stored: StoredTokens = {
      access_token: "a",
      token_type: "bearer",
      expires_at: clock.now().getTime() + 60_000,
    };
    clock.advanceBy(120_000);
    expect(
      applyExpiryPolicy({
        stored,
        serverName: "srv",
        clock,
        logger: noOpLogger,
      }),
    ).toBeUndefined();
  });
});
