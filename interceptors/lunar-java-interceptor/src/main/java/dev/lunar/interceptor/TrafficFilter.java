package dev.lunar.interceptor;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Hashtable;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

public final class TrafficFilter {

    private static TrafficFilter instance;

    private static final String DELIMITER = ",";
    private static final String ALLOW_LIST_KEY = "LUNAR_ALLOW_LIST";
    private static final String BLOCK_LIST_KEY = "LUNAR_BLOCK_LIST";

    private static Optional<Set<String>> allowList = parseList(ALLOW_LIST_KEY);
    private static Optional<Set<String>> blockList = parseList(BLOCK_LIST_KEY);

    private static final Pattern IP_PATTERN = Pattern.compile("^[\\d.]+$");
    private static final Pattern HOST_PATTERN = Pattern.compile(
            "^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\\-]*[a-zA-Z0-9])\\.)"
                    + "*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\\-]*[A-Za-z0-9]){2,}$");

    private static LunarLogger logger = LunarLogger.getLogger();

    private static final Hashtable<String, InetRange> PRIVATE_IP_RANGES =
        new Hashtable<String, InetRange>() {
            {
                try {
                    put(
                            "10",
                            new InetRange(
                                    InetAddress.getByName("10.0.0.0"),
                                    InetAddress.getByName("10.255.255.255")));
                    put(
                            "12",
                            new InetRange(
                                    InetAddress.getByName("127.0.0.0"),
                                    InetAddress.getByName("127.255.255.255")));
                    put(
                            "17",
                            new InetRange(
                                    InetAddress.getByName("172.16.0.0"),
                                    InetAddress.getByName("172.31.255.255")));
                    put(
                            "19",
                            new InetRange(
                                    InetAddress.getByName("192.168.0.0"),
                                    InetAddress.getByName("192.168.255.255")));
                } catch (UnknownHostException e) {
                    logger.debug(
                            String.format(
                                    "TrafficFilter::Could not resolve: '%s'. Error: %s",
                                    e.getMessage()));
                }
            }
        };

    private Hashtable<String, Boolean> isExternalCache;
    private boolean stateOk;

    protected TrafficFilter(Optional<Set<String>> allowList, Optional<Set<String>> blockList) {
        TrafficFilter.allowList = null;
        TrafficFilter.blockList = null;
        TrafficFilter.allowList = allowList;
        TrafficFilter.blockList = blockList;
        this.isExternalCache = new Hashtable<String, Boolean>();
        this.stateOk = validateLists();
    }

    private TrafficFilter() {
        this.isExternalCache = new Hashtable<String, Boolean>();
        this.stateOk = validateLists();
    }

    public static TrafficFilter getInstance() {
        if (instance == null) {
            instance = new TrafficFilter();
        }
        return instance;
    }

    private static Optional<Set<String>> parseList(String listEnvVarKey) {
        String commaSeparatedList = System.getenv(listEnvVarKey);

        if (commaSeparatedList == null) {
            return Optional.empty();
        }

        return Optional.of(
                new HashSet<String>(Arrays.asList(commaSeparatedList.split(DELIMITER))));
    }

    public static Optional<Set<String>> getAllowList() {
        return allowList;
    }

    public static Optional<Set<String>> getBlockList() {
        return blockList;
    }

    public boolean isAllowed(String hostOrIp) {
        if (!this.stateOk) {
            return false;
        }

        Optional<Boolean> isAllowed = checkAllowed(hostOrIp);
        if (isAllowed.isPresent()) {
            return isAllowed.get();
        }

        return checkBlocked(hostOrIp) && isExternal(hostOrIp);
    }

    private Optional<Boolean> checkAllowed(String host) {
        if (!allowList.isPresent()) {
            return Optional.empty();
        }

        return Optional.of(allowList.get().contains(host));
    }

    private boolean checkBlocked(String hostOrIp) {
        if (!blockList.isPresent()) {
            return true;
        }

        return !blockList.get().contains(hostOrIp);
    }

    private boolean isExternal(String hostOrIp) {
        Optional<Boolean> isExternal = Optional.ofNullable(
                this.isExternalCache.get(hostOrIp));

        if (isExternal.isPresent()) {
            return isExternal.get().booleanValue();
        }

        if (validateIp(hostOrIp)) {
            isExternal = isExternalIp(hostOrIp);
        } else {
            isExternal = isExternalDomain(hostOrIp);
        }

        if (!isExternal.isPresent()) {
            // If we can't resolve the host, assume it's internal but don't cache the result
            return false;
        }

        this.isExternalCache.put(hostOrIp, isExternal.get());
        return isExternal.get();
    }

    private boolean validateIp(String ip) {
        return IP_PATTERN.matcher(ip).matches();
    }

    private Optional<Boolean> isExternalIp(String ip) {
        InetAddress address;

        try {
            address = InetAddress.getByName(ip);
        } catch (UnknownHostException e) {
            logger.debug(
                    String.format(
                            "TrafficFilter::Could not resolve: '%s'. Error: %s",
                            ip,
                            e.getMessage()));

            return Optional.of(false);
        }

        Boolean isExternalIp = !isIpInPrivateRange(address);

        return Optional.of(isExternalIp);
    }

    private boolean isIpInPrivateRange(InetAddress address) {
        InetRange range = PRIVATE_IP_RANGES.get(
                address.getHostAddress().substring(0, 2));

        if (range == null) {
            return false;
        }

        return range.isInRange(address);
    }

    private Optional<Boolean> isExternalDomain(String host) {
        try {
            InetAddress address = InetAddress.getByName(host);
            boolean isInPrivateRange = !isIpInPrivateRange(address);

            return Optional.of(isInPrivateRange);
        } catch (UnknownHostException e) {
            logger.debug(
                    String.format(
                            "TrafficFilter::Could not resolve: '%s'. Error: %s",
                            host,
                            e.getMessage()));

            return Optional.empty();
        }
    }

    private boolean validateLists() {
        validateAllow();

        if (!validateBlock()) {
            logger.warning("Interceptor will be disabled to avoid "
                            + "passing wrong traffic through the Proxy.");

            return false;
        }

        return true;
    }

    private boolean validateAllow() {
        if (!allowList.isPresent()) {
            return true;
        }

        for (String hostOrIp : allowList.get()) {
            if (!(validateHost(hostOrIp) || validateIp(hostOrIp))) {
                logger.warning(String.format(
                    "Unsupported value '%s' will be removed from the allowed list.", hostOrIp));
                allowList.get().remove(hostOrIp);

            }
        }

        return true;
    }

    private boolean validateBlock() {
        if (!blockList.isPresent()) {
            return true;
        }

        if (allowList.isPresent()) {
            logger.warning(
                    String.format("TrafficFilter::Found %s ignoring the %s",
                     ALLOW_LIST_KEY, BLOCK_LIST_KEY));
            blockList = Optional.empty();

            return true;
        }

        boolean isValid = true;
        for (String hostOrIp : blockList.get()) {
            if (!(validateHost(hostOrIp) || validateIp(hostOrIp))) {
                logger.warning(
                        String.format("Error while parsing '%s' from the block list", hostOrIp));
                isValid = false;
            }
        }

        return isValid;
    }

    private boolean validateHost(String host) {
        if (IP_PATTERN.matcher(host).matches()) {
            return false;
        }

        return HOST_PATTERN.matcher(host).matches();
    }
}
