package dev.lunar.interceptor;

import dev.lunar.clock.Clock;
import dev.lunar.clock.RealClock;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public class Retry {
    protected static final int TIME_CONVERTER = 1000;
    protected static final String LUNAR_SEQ_ID_HEADER_KEY = "x-lunar-sequence-id";
    protected static final String LUNAR_RETRY_AFTER_HEADER_KEY = "x-lunar-retry-after";
    private static Clock clock = new RealClock();

    private Optional<String> sequenceId;
    private LunarLogger lunarLogger;

    public Retry() {
        this.sequenceId = Optional.empty();
        this.lunarLogger = LunarLogger.getLogger();
    }

    protected Retry(Clock clock) {
        this.lunarLogger = LunarLogger.getLogger();
        Retry.clock = clock;
    }

    /**
     * @return Gets the header name that represents Lunar's internal sequence ID.
     */
    public static String getLunarSeqIdHeaderKey() {
        return LUNAR_SEQ_ID_HEADER_KEY;
    }

    public Optional<String> getSequenceId() {
        return this.sequenceId;
    }

    public void setSequenceId(Optional<String> sequenceId) {
        this.sequenceId = sequenceId;
    }

    /**
     * @param headers the headers obtained in the response of a single request
     *                within a
     *                request sequence.
     * @return a sequenceId to be used in the next (retry) request,
     *         or Empty if no retry was required.
     */
    public Optional<String> prepareForRetry(Map<String, List<String>> headers) {
        List<String> rawRetryAfters = headers.getOrDefault(
                LUNAR_RETRY_AFTER_HEADER_KEY,
                Collections.emptyList());

        if (rawRetryAfters.size() < 1) {
            return Optional.empty();
        }

        Optional<Float> rawRetryAfter = Optional
                .ofNullable(rawRetryAfters.get(0))
                .flatMap(this::parseFloatOrEmpty);

        if (!rawRetryAfter.isPresent()) {
            return Optional.empty();
        }

        Double retryAfterMillis = rawRetryAfter.get().doubleValue() * TIME_CONVERTER;

        if (retryAfterMillis < 1) {
            this.lunarLogger.debug(
                    "Retry required but value is below 1, skipping retry flow");

            return Optional.empty();
        }

        List<String> rawSequenceIds = headers.getOrDefault(
                LUNAR_SEQ_ID_HEADER_KEY,
                Collections.emptyList());
        if (rawSequenceIds.size() < 1) {
            this.lunarLogger.debug("Retry required, but"
                    + LUNAR_SEQ_ID_HEADER_KEY
                    + " is missing!, skipping retry flow");

            return Optional.empty();
        }

        sequenceId = Optional.ofNullable(rawSequenceIds.get(0));

        if (sequenceId.isPresent() && sequenceId.get().isEmpty()) {
            this.lunarLogger.debug(
                    "Retry required, but " + LUNAR_SEQ_ID_HEADER_KEY + " is missing!");

            return Optional.empty();
        }

        this.lunarLogger.debug(
                "Retry required, will retry in " + retryAfterMillis + " millis...");

        clock.lowPrioritySleep(retryAfterMillis.longValue());

        return sequenceId;
    }

    private Optional<Float> parseFloatOrEmpty(String raw) {
        try {
            return Optional.of(Float.parseFloat(raw));
        } catch (NumberFormatException e) {
            this.lunarLogger.debug(
                    "Retry required, but parsing header "
                            + LUNAR_RETRY_AFTER_HEADER_KEY
                            + " as float failed (" + raw + ")");

            return Optional.empty();
        }
    }
}
