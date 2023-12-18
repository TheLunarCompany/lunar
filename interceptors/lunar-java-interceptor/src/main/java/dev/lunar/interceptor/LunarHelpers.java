package dev.lunar.interceptor;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Optional;

public final class LunarHelpers {
    private static final int HTTP_STATUS_OK = 200;
    private static final String MANAGED = "managed";
    private static LunarLogger logger = LunarLogger.getLogger();

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
     * @param handshakeURL The URL to execute the requests against (should return status 200 OK)
     * @return true if the connection is valid.
     */
    static boolean validateLunarProxyConnection(String handshakeURL) {
        boolean connectionValidate = false;

        logger.debug("Establishing handshake with Lunar Proxy...");
        try {
            URI uri = new URI(handshakeURL);
            HttpURLConnection connection = (HttpURLConnection) uri.toURL().openConnection();
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setRequestMethod("GET");

            connectionValidate = connection.getResponseCode() == HTTP_STATUS_OK;

            String contentType = connection.getHeaderField("Content-Type");
            if (contentType != null && contentType.contains("application/json")) {
                // Read and parse the JSON response
                try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(connection.getInputStream()))) {
                    StringBuilder jsonResponse = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        jsonResponse.append(line);
                    }

                    JSONObject json = new JSONObject(jsonResponse.toString());
                    TrafficFilter.getInstance().setProxyManaged(json.getBoolean(MANAGED));
                }
            }
            connection.disconnect();

        } catch (URISyntaxException | IOException | JSONException e) {
            logger.warning(
                String.format(
                    "An error occurred during proxy connection validation. Error: %s",
                    e.getMessage()));
        }

        return connectionValidate;
    }
}
