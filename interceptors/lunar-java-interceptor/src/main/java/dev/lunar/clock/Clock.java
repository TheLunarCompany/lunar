package dev.lunar.clock;

public interface Clock {
    /**
     * This allows to check the current time.
     *
     * @return the current time in milliseconds.
     */
    long currentTimeMillis();

    /**
     * This sleeps the current thread for the given time.
     *
     * @param timeMs the time to sleep in milliseconds.
     * @throws InterruptedException
     */
    void sleep(long timeMs);

    /**
     * This sleeps with low priority functionality for the given time (to allow the
     * thread to execute another work if needed).
     *
     * @param timeMs the time to sleep in milliseconds.
     * @throws InterruptedException
     */
    void lowPrioritySleep(long timeMs);
}
