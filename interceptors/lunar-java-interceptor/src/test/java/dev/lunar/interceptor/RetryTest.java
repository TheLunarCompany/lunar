package dev.lunar.interceptor;

import dev.lunar.clock.MockClock;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

public class RetryTest {

    private Retry retry = new Retry(new MockClock());

    @Test
    void testItReturnsSeqIdWhenBothRetryAfterAndSeqIdHeadersArePresent() {
        Map<String, List<String>> headers = new HashMap<String, List<String>>() {
            {
                put(Retry.LUNAR_RETRY_AFTER_HEADER_KEY, Arrays.asList("10"));
                put(Retry.LUNAR_SEQ_ID_HEADER_KEY, Arrays.asList("abc"));
            }
        };

        String res = retry.prepareForRetry(headers).get();
        assertEquals("abc", res);
    }

    @Test
    void testItReturnsNullWhenBothRetryAfterAndSeqIdHeadersArePresentButRetryAfterIsMalformed() {
        Map<String, List<String>> headers = new HashMap<String, List<String>>() {
            {
                put(Retry.LUNAR_RETRY_AFTER_HEADER_KEY, Arrays.asList("not-a-number"));
                put(Retry.LUNAR_SEQ_ID_HEADER_KEY, Arrays.asList("abc"));
            }
        };
        Optional<String> res = retry.prepareForRetry(headers);
        assertEquals(Optional.empty(), res);
    }

    @Test
    void testItReturnsNullWhenRetryAfterIsPresentButSeqIdHeaderIsMissing() {
        Map<String, List<String>> headers = new HashMap<String, List<String>>() {
            {
                put(Retry.LUNAR_RETRY_AFTER_HEADER_KEY, Arrays.asList("10"));
            }
        };
        Optional<String> res = retry.prepareForRetry(headers);
        assertEquals(Optional.empty(), res);
    }

    @Test
    void testItReturnsNullWhenSeqIdIsPresentButRetryAfterHeaderIsMissing() {
        Map<String, List<String>> headers = new HashMap<String, List<String>>() {
            {
                put(Retry.LUNAR_SEQ_ID_HEADER_KEY, Arrays.asList("abc"));
            }
        };
        Optional<String> res = retry.prepareForRetry(headers);
        assertEquals(Optional.empty(), res);
    }

    @Test
    void testItReturnsNullRetryAfterIsLowerThanOne() {
        Map<String, List<String>> headers = new HashMap<String, List<String>>() {
            {
                put(Retry.LUNAR_SEQ_ID_HEADER_KEY, Arrays.asList("abc"));
                put(Retry.LUNAR_RETRY_AFTER_HEADER_KEY, Arrays.asList("0"));
            }
        };
        Optional<String> res = retry.prepareForRetry(headers);
        assertEquals(Optional.empty(), res);
    }

    @Test
    void testItReturnsNullWhenRetryAfterHeaderHasNoValues() {
        Map<String, List<String>> headers = new HashMap<String, List<String>>() {
            {
                put(Retry.LUNAR_SEQ_ID_HEADER_KEY, Arrays.asList("abc"));
                put(Retry.LUNAR_RETRY_AFTER_HEADER_KEY, Collections.emptyList());
            }
        };
        Optional<String> res = retry.prepareForRetry(headers);
        assertEquals(Optional.empty(), res);
    }

    @Test
    void testItReturnsNullWhenSeqIdHeaderHasNoValues() {
        Map<String, List<String>> headers = new HashMap<String, List<String>>() {
            {
                put(Retry.LUNAR_SEQ_ID_HEADER_KEY, Collections.emptyList());
                put(Retry.LUNAR_RETRY_AFTER_HEADER_KEY, Arrays.asList("10"));
            }
        };
        Optional<String> res = retry.prepareForRetry(headers);
        assertEquals(Optional.empty(), res);
    }
}
