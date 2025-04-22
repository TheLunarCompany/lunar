package dev.lunar.interceptor;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class TrafficFilterTest {

    @Test
    void testTrafficFilterOnlyAllowsExternalTraffic() {
        TrafficFilter trafficFilter = new TrafficFilter(Optional.empty(), Optional.empty());
        trafficFilter.setProxyManaged(false);

        assertTrue(trafficFilter.isAllowed("google.com", Optional.empty()));
        assertTrue(trafficFilter.isAllowed("api.twitter.com", Optional.empty()));
        assertTrue(trafficFilter.isAllowed("lunar.dev", Optional.empty()));
        assertTrue(trafficFilter.isAllowed("148.23.1.1", Optional.empty()));
        assertTrue(trafficFilter.isAllowed("httpbinmock", Optional.of("true")));

        assertFalse(trafficFilter.isAllowed("192.168.4.12", Optional.empty()));
        assertFalse(trafficFilter.isAllowed("10.50.20.22", Optional.empty()));
    }

    @Test
    void testTrafficFilterAllowsInternalTrafficIfHostOrIpIsInAllowedList() {
        Set<String> allowList = new HashSet<String>(
                new ArrayList<String>() {
                    {
                        add("api.twitter.com");
                        add("192.168.4.12");
                    }
                });
        TrafficFilter trafficFilter = new TrafficFilter(Optional.of(allowList), Optional.empty());
        trafficFilter.setProxyManaged(false);

        assertTrue(trafficFilter.isAllowed("api.twitter.com", Optional.empty()));
        assertTrue(trafficFilter.isAllowed("192.168.4.12", Optional.empty()));

        assertFalse(trafficFilter.isAllowed("google.com", Optional.empty()));
        assertFalse(trafficFilter.isAllowed("lunar.dev", Optional.empty()));
        assertFalse(trafficFilter.isAllowed("httpbinmock", Optional.empty()));
        assertFalse(trafficFilter.isAllowed("10.50.20.22", Optional.empty()));
    }

    @Test
    void testTrafficFilterOnlyAllowsHostsInAllowList() {
        Set<String> allowList = new HashSet<String>(
                new ArrayList<String>() {
                    {
                        add("api.twitter.com");
                        add("lunar.dev");
                    }
                });

        TrafficFilter trafficFilter = new TrafficFilter(Optional.of(allowList), Optional.empty());
        trafficFilter.setProxyManaged(false);

        assertTrue(trafficFilter.isAllowed("api.twitter.com", Optional.empty()));
        assertTrue(trafficFilter.isAllowed("lunar.dev", Optional.empty()));

        assertFalse(trafficFilter.isAllowed("google.com", Optional.empty()));
        assertFalse(trafficFilter.isAllowed("148.23.1.1", Optional.empty()));
    }

    @Test
    void testTrafficFilterOnlyAllowsHostsNotInBlockList() {
        Set<String> blockList = new HashSet<String>(
                new ArrayList<String>() {
                    {
                        add("api.twitter.com");
                        add("lunar.dev");
                    }
                });

        TrafficFilter trafficFilter = new TrafficFilter(Optional.empty(), Optional.of(blockList));
        trafficFilter.setProxyManaged(false);

        assertTrue(trafficFilter.isAllowed("google.com", Optional.empty()));
        assertTrue(trafficFilter.isAllowed("148.23.1.1", Optional.empty()));

        assertFalse(trafficFilter.isAllowed("api.twitter.com", Optional.empty()));
        assertFalse(trafficFilter.isAllowed("lunar.dev", Optional.empty()));
    }

    @Test
    void testTrafficFilterIgnoresBlockListIfAllowListIsNotEmpty() {
        Set<String> blockList = new HashSet<String>(
                new ArrayList<String>() {
                    {
                        add("api.twitter.com");
                        add("lunar.dev");
                    }
                });
        Set<String> allowList = new HashSet<String>(
                new ArrayList<String>() {
                    {
                        add("api.twitter.com");
                        add("lunar.dev");
                        add("google.com");
                    }
                });
        TrafficFilter trafficFilter = new TrafficFilter(Optional.of(allowList),
                Optional.of(blockList));
        trafficFilter.setProxyManaged(false);

        assertTrue(trafficFilter.isAllowed("google.com", Optional.empty()));
        assertTrue(trafficFilter.isAllowed("api.twitter.com", Optional.empty()));
        assertTrue(trafficFilter.isAllowed("lunar.dev", Optional.empty()));

        assertFalse(trafficFilter.isAllowed("148.23.1.1", Optional.empty()));
    }
}
