package dev.lunar.interceptor;

import dev.lunar.clock.MockClock;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class FailSafeTest {
    private int timeConvert = 1000;
    private Optional<Integer> maxErrorAllowed = Optional.of(2);
    private Optional<Integer> failSafeCooldownSec = Optional.of(4);
    private FailSafe failSafe;
    private MockClock mockClock;

    @BeforeEach
    void setUp() {
        mockClock = new MockClock();
        failSafe = new FailSafe(failSafeCooldownSec, maxErrorAllowed, mockClock);
    }

    @Test
    void testEnterFailsSafeAfterMaxErrorHasCounted() {
        assertTrue(failSafe.stateOk(), "FailSafe state should be OK");

        for (int i = 0; i < maxErrorAllowed.get(); i++) {
            failSafe.onError("");
        }

        assertFalse(failSafe.stateOk(), "FailSafe state should not be OK");
    }

    @Test
    void testExitFailsSafeAfterCooldownHasPassed() throws InterruptedException {
        for (int i = 0; i < maxErrorAllowed.get(); i++) {
            failSafe.onError("");
        }

        assertFalse(failSafe.stateOk(), "FailSafe state should not be OK");

        mockClock.sleep(failSafeCooldownSec.get() * timeConvert);

        assertTrue(failSafe.stateOk(), "FailSafe state should be OK");
    }

    @Test
    void testFailSafeEnterDirectlyToCooldownOnFirstConnectionErrorAfterCooldown()
            throws InterruptedException {
        for (int i = 0; i < maxErrorAllowed.get(); i++) {
            failSafe.onError("");
        }

        assertFalse(failSafe.stateOk(), "FailSafe state should not be OK");

        mockClock.sleep(failSafeCooldownSec.get() * timeConvert);

        assertTrue(failSafe.stateOk(), "FailSafe state should be OK");

        failSafe.onError("");

        assertFalse(failSafe.stateOk(), "FailSafe state should not be OK");
    }

    @Test
    void testFailSafeDoesNotEnterToCooldownAfterSuccessfulConnectionAfterCooldown()
            throws InterruptedException {
        for (int i = 0; i < maxErrorAllowed.get(); i++) {
            failSafe.onError("");
        }

        assertFalse(failSafe.stateOk(), "FailSafe state should not be OK");

        mockClock.sleep(failSafeCooldownSec.get() * timeConvert);

        assertTrue(failSafe.stateOk(), "FailSafe state should be OK");

        failSafe.onSuccess("");

        failSafe.onError("");

        assertTrue(failSafe.stateOk(), "FailSafe state should be OK");
    }
}
