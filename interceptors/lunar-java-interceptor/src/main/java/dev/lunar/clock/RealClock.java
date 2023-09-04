package dev.lunar.clock;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;

public class RealClock implements Clock {

    public long currentTimeMillis() {
        return System.currentTimeMillis();
    }

    @Override
    public void sleep(long timeMs) {
        try {
            Thread.sleep(timeMs);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    @Override
    public void lowPrioritySleep(long timeMs) {
        CompletableFuture<Void> completableFuture = CompletableFuture.supplyAsync(() -> {
            try {
                TimeUnit.MILLISECONDS.sleep(timeMs);
            } catch (InterruptedException e) {
            }
            return null;
        });

        try {
            completableFuture.get();
        } catch (InterruptedException | ExecutionException e) {
        }
    }
}
