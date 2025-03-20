package dev.lunar.clock;

public class MockClock implements Clock {

    private long currentTimeMs = System.currentTimeMillis();

    @Override
    public long currentTimeMillis() {
        return this.currentTimeMs;
    }

    @Override
    public void sleep(long timeMs) {
        this.currentTimeMs += timeMs;
    }

    @Override
    public void lowPrioritySleep(long timeMs) {
        this.sleep(timeMs);
    }
}
