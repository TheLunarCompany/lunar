package dev.lunar.interceptor;

import java.util.Optional;

public class RoutingData {

    private static final int HTTP_PORT = 80;
    private static final int HTTPS_PORT = 443;
    private static Optional<String> proxyUrl = getProxyUrl();
    private static final String DELIMITER = ":";
    private static final String HANDSHAKE_PORT_DEFAULT = "8081";
    private static final String LUNAR_HOST_HEADER_KEY = "x-lunar-host";
    private static final String LUNAR_SCHEME_HEADER_KEY = "x-lunar-scheme";
    private static final String PROXY_HOST_KEY = "LUNAR_PROXY_HOST";
    private static final String HANDSHAKE_PORT_KEY = "LUNAR_HANDSHAKE_PORT";
    private static final String LUNAR_INTERCEPTOR_HEADER_KEY = "x-lunar-interceptor";
    private static final String INTERCEPTOR_TYPE_VALUE = "lunar-java-interceptor";
    private static final String INTERCEPTOR_HEADER_DELIMITER = "/";
    private static final String LUNAR_TENANT_ID_HEADER_KEY = "x-lunar-tenant-id";
    private static final String LUNAR_TENANT_ID = "LUNAR_TENANT_ID";

    private static String interceptorVersionValue = getInterceptorVersion();
    private static LunarLogger lunarLogger = LunarLogger.getLogger();
    private static String tenantId = getLunarTenantId();

    private String originalHost;

    private String originalScheme;

    private int originalPort;

    public RoutingData(String host, String scheme, int port) {
        this.originalHost = host;
        this.originalScheme = scheme;
        this.originalPort = port;
    }

    /**
     * @return Gets the LunarProxy host value configured in the environment,
     *         if nothing is set, then this will return an empty Optional object.
     */
    protected static Optional<String> getProxyHost() {
        String proxyHostValue = LunarHelpers.getStrFromEnv(PROXY_HOST_KEY, "null");

        if (proxyHostValue.equals("null")) {
            lunarLogger.warning(String.format(
                "Could not obtain the Host value of Lunar Proxy from environment variables,\n"
                + "please set %s to the Lunar Proxy's host/IP and port in order to allow the interceptor to be loaded.", PROXY_HOST_KEY));
            return Optional.empty();
        }

        String[] proxyHostAndPort = proxyHostValue.split(":");
        if (proxyHostAndPort.length == 0) {
            lunarLogger.warning(String.format(
                "Could not obtain the Host value of Lunar Proxy from environment variables,\n"
                + "please set %s to the Lunar Proxy's host/IP and port in.\n"
                + "current value: %s", PROXY_HOST_KEY, proxyHostValue));
            return Optional.empty();
        }

        if (proxyHostAndPort.length == 1) {
            lunarLogger.warning(String.format(
                "Could not obtain the Port value of Lunar Proxy from environment variables,\n"
                + "please set %s to the Lunar Proxy's host/IP and port in order to allow the interceptor to be loaded.\n"
                + "current value: %s", PROXY_HOST_KEY, proxyHostValue));
            return Optional.empty();
        }

        if (proxyHostAndPort.length > 2) {
            lunarLogger.warning(String.format(
                "Could not parse the Host value of Lunar Proxy from environment variables,\n"
                + "please set %s to the Lunar Proxy's host/IP and port in with the format of 'host:port'.\n"
                + "Please note that the value should not contain any additional ':' such as Protocol in order to allow the interceptor to be loaded.\n"
                + "current value: %s", PROXY_HOST_KEY, proxyHostValue));
            return Optional.empty();
        }

        try {
            Integer.parseInt(proxyHostAndPort[1]);
        } catch (NumberFormatException e) {
            lunarLogger.warning(String.format(
                "Could not parse the port value of Lunar Proxy from environment variables,\n"
                + "please set %s to the Lunar Proxy's host/IP and port in with the format of 'host:port'.\n"
                + "Please note that the Port should be a valid number in order to allow the interceptor to be loaded.\n"
                + "current value: %s", PROXY_HOST_KEY));
            return Optional.empty();
        }

        return Optional.of(proxyHostValue);
    }

    /**
     * @return Gets the LunarProxy handshake prot value configured in the
     *         environment,
     *         if nothing is set, then this will return an empty Optional object.
     */
    protected static String getHandshakePort() {
        return LunarHelpers.getStrFromEnv(HANDSHAKE_PORT_KEY, HANDSHAKE_PORT_DEFAULT);
    }

    /**
     * @return Gets the tenant id value configured in the environment,
     *         if nothing is set, then will return unknown string.
     */
    protected static String getLunarTenantId() {
        String tenantIdFromEnv = System.getenv(LUNAR_TENANT_ID);
        return (tenantIdFromEnv != null) ? tenantIdFromEnv : "unknown";
    }

    /**
     * @return Gets the LunarProxy host key to get the value for the ENV.
     */
    protected static String getProxyHostKey() {
        return PROXY_HOST_KEY;
    }

    /**
     * @return Gets the LunarProxy scheme value configured in the environment,
     *         if nothing is set, then this will return a the default 'http'.
     */
    private static String getProxyScheme() {
        Optional<String> lunarSupportTls = Optional.ofNullable(
                System.getenv("LUNAR_PROXY_SUPPORT_TLS"));
        if (lunarSupportTls.isPresent() && "1".equals(lunarSupportTls.get())) {
            return "https";
        }
        return "http";
    }

    /**
     * @return Gets the current interceptor version.
     */
    protected static String getInterceptorVersion() {
        return Interceptor.class.getPackage().getImplementationVersion();
    }

    /**
     * @return Gets the LunarProxy URL value,
     *         if nothing is set, then this will return an empty Optional object.
     */
    private static Optional<String> getProxyUrl() {
        return getProxyHost()
                .map(host -> RoutingData.getProxyScheme() + "://" + host);
    }

    private static String ensureStringPrefix(String str, String prefix) {
        if (str.startsWith(prefix)) {
            return str;
        } else {
            return prefix + str;
        }
    }

    private static Optional<String> getProxyHandshakeCheckURL() {
        return getProxyHost()
                .map(host -> RoutingData.getProxyScheme() + "://"
                        + host.split(DELIMITER)[0] + ":" + getHandshakePort() + "/handshake");
    }

    /**
     * Validate the connection status between the Interceptor and Lunar Proxy.
     */
    public static boolean validateLunarProxyConnection() {
        Optional<String> proxyHost = getProxyHost();
        if (!proxyHost.isPresent()) {
            return false;
        }
        LunarLogger.getLogger().debug("Testing the communication with Lunar Proxy...");
        Optional<String> handshakeCheckURL = getProxyHandshakeCheckURL();

        if (!handshakeCheckURL.isPresent()) {
            LunarLogger.getLogger().debug("Lunar Proxy host was not configured!");
            return false;
        }

        // deepcode ignore Ssrf: <This is the validator for the URL value>
        if (!LunarHelpers.validateLunarProxyConnection(handshakeCheckURL.get())) {
            // CHECKSTYLE.OFF
            LunarLogger.getLogger().warning("[ⓧ ] Failed to communicate with Lunar Proxy.\n"
                    + "\tPlease make sure that Lunar Proxy is running "
                    + "and right value is set on key '\" + HANDSHAKE_PORT_KEY + \"' "
                    + "\n"
                    + "\tFor more information please refer to: "
                    + "http://docs.lunar.dev/installation-configuration/configuration#lunar-interceptor-configuration\n");
            // CHECKSTYLE.ON
            return false;
        } else {
            LunarLogger.getLogger().debug("[ⓥ ] Successfully communicate with Lunar Proxy");
            return true;
        }
    }

    /**
     *
     * @return Gets the host header key,
     *         this is the key containing the value to manipulate.
     */
    public String getHostHeaderKey() {
        return LUNAR_HOST_HEADER_KEY;
    }

    /**
     * @return Gets the scheme header key,
     *         this is the key containing the value to manipulate.
     */
    public String getSchemeHeaderKey() {
        return LUNAR_SCHEME_HEADER_KEY;
    }

    /**
     *
     * @return Gets the lunar-interceptor key,
     *         this key contains the value to specify the Interceptor type and
     *         version.
     */
    public static String getLunarInterceptorHeaderKey() {
        return LUNAR_INTERCEPTOR_HEADER_KEY;
    }

    /**
     *
     * @return Gets the lunar-tenant-id key,
     *         this is the key containing the LUNAR_TENANT_ID value.
     */
    public static String getLunarTenantIdHeaderKey() {
        return LUNAR_TENANT_ID_HEADER_KEY;
    }

    /**
     * @return The host data to populate the relevant Host header.
     */
    public String getHostHeaderValue() {
        if (this.originalPort == HTTP_PORT || this.originalPort == HTTPS_PORT) {
            return this.originalHost;
        }
        return this.originalHost + ":" + this.originalPort;
    }

    /**
     * @return The scheme data to populate the relevant Scheme header.
     */
    public String getSchemeHeaderValue() {
        return this.originalScheme;
    }

    /**
     * @return The lunar-interceptor data to populate the network protocol.
     */
    public static String getLunarInterceptorHeaderValue() {
        return INTERCEPTOR_TYPE_VALUE
                + INTERCEPTOR_HEADER_DELIMITER
                + interceptorVersionValue;
    }

    /**
     * @return The lunar tenant id to handshake with managed lunar proxy.
     */
    public String getLunarTenantIdHeaderValue() {
        return tenantId;
    }

    /**
     * @param path  The original path of the request.
     * @param query The original query of the request.
     * @return The modified URL.
     */
    public String buildUrl(String path, String query) {
        Optional<String> pathObj = Optional.ofNullable(path);
        Optional<String> queryObj = Optional.ofNullable(query);

        String modifiedQuery = queryObj.map(q -> ensureStringPrefix(q, "?")).orElse("");
        String modifiedPath = pathObj.map(p -> ensureStringPrefix(p, "/")).orElse("");

        // deepcode ignore checkIsPresent~Optional: <Already validated>
        String url = RoutingData.proxyUrl.get() + modifiedPath + modifiedQuery;

        // deepcode ignore LogLevelCheck: <We first validate the log level>
        if (RoutingData.lunarLogger.isDebugLevel()) {
            // deepcode ignore LogLevelCheck: <We first validate the log level>
            RoutingData.lunarLogger.debug("Building url: " + url);
        }

        return url;
    }
}
