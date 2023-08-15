package dev.lunar.interceptor;

import java.util.Optional;

public class RoutingData {

    private static final int HTTP_PORT = 80;
    private static final int HTTPS_PORT = 443;
    private static Optional<String> proxyUrl = getProxyUrl();
    private static final String DELIMITER = ":";
    private static final String HEALTHCHECK_PORT_DEFAULT = "8040";
    private static final String LUNAR_HOST_HEADER_KEY = "Host";
    private static final String LUNAR_SCHEME_HEADER_KEY = "x-lunar-scheme";
    private static final String PROXY_HOST_KEY = "LUNAR_PROXY_HOST";
    private static final String HEALTHCHECK_PORT_KEY = "LUNAR_HEALTHCHECK_PORT";
    private static final String LUNAR_INTERCEPTOR_HEADER_KEY = "x-lunar-interceptor";
    private static final String INTERCEPTOR_TYPE_VALUE = "lunar-java-interceptor";
    private static final String INTERCEPTOR_HEADER_DELIMITER = "/";

    private static String interceptorVersionValue = getInterceptorVersion();

    private LunarLogger lunarLogger;

    private String originalHost;

    private String originalScheme;

    private int originalPort;

    public RoutingData(String host, String scheme, int port) {
        this.originalHost = host;
        this.originalScheme = scheme;
        this.originalPort = port;
        this.lunarLogger = LunarLogger.getLogger();
    }

    /**
     * @return Gets the LunarProxy host value configured in the environment,
     *         if nothing is set, then this will return an empty Optional object.
     */
    protected static Optional<String> getProxyHost() {
        return Optional.ofNullable(System.getenv(PROXY_HOST_KEY));
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
    private static String getInterceptorVersion() {
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

    private static Optional<String> getProxyHealthCheckURL(String healthCheckPort) {
        return getProxyHost()
                .map(host -> RoutingData.getProxyScheme() + "://"
                 + host.split(DELIMITER)[0] + ":" + healthCheckPort + "/healthcheck");
    }

    /**
     * Validate the connection status between the Interceptor and Lunar Proxy.
     */
    public static void validateLunarProxyConnection() {
        LunarLogger.getLogger().debug("Testing the communication with Lunar Proxy...");
        String proxyHealthCheckPort = LunarHelpers.getStrFromEnv(HEALTHCHECK_PORT_KEY,
            HEALTHCHECK_PORT_DEFAULT);
        Optional<String> healthCheckURL = getProxyHealthCheckURL(proxyHealthCheckPort);

        if (!healthCheckURL.isPresent()) {
            LunarLogger.getLogger().debug("Lunar Proxy host was not configured!");
            return;
        }

        if (!LunarHelpers.validateLunarProxyConnection(healthCheckURL.get())) {
            //CHECKSTYLE.OFF
            LunarLogger.getLogger().warning("[ⓧ ] Failed to communicate with Lunar Proxy.\n"
                                            + "\tPlease make sure that Lunar Proxy is running and port '" + proxyHealthCheckPort + "' "
                                            + "is set as the healthcheck port.\n"
                                            + "\tFor more information please refer to: "
                                            + "http://docs.lunar.dev/installation-configuration/configuration#lunar-interceptor-configuration\n");
            //CHECKSTYLE.ON
        } else {
            LunarLogger.getLogger().debug("[ⓥ ] Successfully communicate with Lunar Proxy");
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
     *         this  key contains the value to specify the Interceptor type and version.
     */
    public static String getLunarInterceptorHeaderKey() {
        return LUNAR_INTERCEPTOR_HEADER_KEY;
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
     * @param path  The original path of the request.
     * @param query The original query of the request.
     * @return The modified URL.
     */
    public String buildUrl(String path, String query) {
        Optional<String> pathObj = Optional.ofNullable(path);
        Optional<String> queryObj = Optional.ofNullable(query);

        String modifiedQuery = queryObj.map(q -> ensureStringPrefix(q, "?")).orElse("");
        String modifiedPath = pathObj.map(p -> ensureStringPrefix(p, "/")).orElse("");

        String url = RoutingData.proxyUrl.get() + modifiedPath + modifiedQuery;
        this.lunarLogger.debug("Building url: " + url);

        return url;
    }
}
