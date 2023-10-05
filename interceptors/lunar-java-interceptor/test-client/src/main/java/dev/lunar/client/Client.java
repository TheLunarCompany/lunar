package dev.lunar.client;

import java.io.IOException;
import io.javalin.Javalin;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.MediaType;
import okhttp3.CacheControl;
import okhttp3.RequestBody;
import java.util.Collections;

public final class Client {
    public static final MediaType JSON = MediaType.get("application/json; charset=utf-8");
    private static final String HTTP_BIN_MOCK_URL = "http://httpbinmock";
    private static final int DEFAULT_PORT = 8080;

    private Client() {
    }

    public static void main(String[] args) {
        java.security.Security.setProperty("networkaddress.cache.ttl", "0");
        java.security.Security.setProperty("networkaddress.cache.negative.ttl", "0");

        Javalin app = Javalin.create().start(DEFAULT_PORT);
        OkHttpClient client = new OkHttpClient();

        app.get(
            "/trigger",
            ctx -> {
                ctx.result(makeRequest(client, HTTP_BIN_MOCK_URL + "/uuid"));
            }
        );


        app.post(
            "/trigger_post",
            ctx -> {
                ctx.result(makePostRequest(client, HTTP_BIN_MOCK_URL + "/post", ctx.body()));
            }
        );

        app.get(
            "/trigger_headers",
            ctx -> {
                ctx.result(makeRequest(client, HTTP_BIN_MOCK_URL + "/headers"));
            }
        );

        app.get(
            "/trigger_bad_url",
            ctx -> {
                ctx.result(
                    makeRequest(client, HTTP_BIN_MOCK_URL + "/anything/bad_url")
                );
            }
        );

        app.get(
            "/trigger_local",
            ctx -> {
                ctx.result(makeRequest(client, HTTP_BIN_MOCK_URL + "/uuid"));
            }
        );

        app.get(
            "/trigger_dynamic",
            ctx -> {
                String method = ctx.queryParam("method");
                String url = ctx.queryParam("url");

                if (method == null || url == null) {
                    throw new IllegalArgumentException(
                        "must supply method and URL in query params"
                    );
                }

                ctx.result(makeRequestWithMethod(client, method, url));
            }
        );

        app.get(
            "/trigger_retry",
            ctx -> {
                ctx.result(
                    makeRequest(client, HTTP_BIN_MOCK_URL + "/anything/retry/attempt")
                );
            }
        );

        app.get(
            "/healthcheck",
            ctx -> {
                ctx.json(Collections.singletonMap("status", "OK"));
            }
        );
    }

    private static String makeRequest(OkHttpClient client, String url) throws IOException {
        Request request = new Request.Builder()
            .url(url)
            .build();

        return Client.executeRequest(client, request);
    }

    private static String makePostRequest(OkHttpClient client, String url, String body) throws IOException {
        RequestBody bodyObj = RequestBody.create(JSON, body);
        Request request = new Request.Builder()
            .url(url)
            .post(bodyObj)
            .build();

        return Client.executeRequest(client, request);
    }

    private static String makeRequestWithMethod(
        OkHttpClient client,
        String method,
        String url
    ) throws IOException {

        Request request = new Request.Builder()
            .cacheControl(new CacheControl.Builder().noCache().build())
            .url(url)
            .method(method, null)
            .build();
            
        return Client.executeRequest(client, request);
    }

    private static String executeRequest(OkHttpClient client, Request request) throws IOException {
        Response response = client.newCall(request).execute();
        String resultBody = "";

        if (response.isSuccessful()) {
            resultBody = response.body().string();
        }

        response.close();
        return resultBody;
    }
}
