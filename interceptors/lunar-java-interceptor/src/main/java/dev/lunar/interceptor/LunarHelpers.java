package dev.lunar.interceptor;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Optional;

public final class LunarHelpers {
    private static final int HTTP_STATUS_OK = 200;

    private LunarHelpers() {}

    /**
     * @param envKey The key to get the value from
     * @param defaultValue Default value to return in case the key don't exists.
     * @return The converted value from the ENV if exists else the default.
     */
    static String getStrFromEnv(String envKey, String defaultValue) {
        return Optional
                .ofNullable(System.getenv(envKey))
                .orElse(defaultValue);
    }

    /**
     * @param envKey The key to get the value from
     * @param defaultValue Default value to return in case the key don't exists.
     * @return The converted value from the ENV if exists else the default.
     */
    static int getIntFromEnv(String envKey, int defaultValue) {
        return Optional
                .ofNullable(System.getenv(envKey))
                .map(Integer::parseInt)
                .orElse(defaultValue);
    }

    /** Validate that the Interceptor can communicate with Lunar Proxy
     * @param healthCheckURL The URL to execute the requests against (should return status 200 OK)
     * @return true if the connection is valid.
     */
    static boolean validateLunarProxyConnection(String healthCheckURL) {
        boolean connectionValidate = false;

        try {
            URI uri = new URI(healthCheckURL);
            HttpURLConnection connection = (HttpURLConnection) uri.toURL().openConnection();
            connection.setRequestMethod("GET");
            connectionValidate = connection.getResponseCode() == HTTP_STATUS_OK;
            connection.disconnect();

        } catch (URISyntaxException | IOException e) { }

        return connectionValidate;
    }
}
