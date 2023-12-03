Feature: Lunar Proxy - Discovered Endpoint Metrics
    Scenario: Discovered Endpoint Metrics are written
        Given   API Provider is up
        When    mox is set to return status code 201 on GET /status
        And     3 requests to GET http:// mox :8888 /status are made through Lunar Proxy with headers {"x-lunar-interceptor": "lunar-aiohttp-interceptor/2.1.2"}
        And     mox is set to return status code 402 on GET /status
        And     1 requests to GET http:// mox :8888 /status are made through Lunar Proxy with headers {"lunar-interceptor": "lunar-aiohttp-interceptor/2.1.3"}
        And     mox is set to return status code 200 on POST /status
        And     5 requests to POST http:// mox :8888 /status are made through Lunar Proxy with headers {"x-lunar-interceptor": "lunar-aiohttp-interceptor:2.1.2"}
        Then    Discovered endpoint metrics for GET mox /status has 4 requests ({"201": 3, "402": 1})
        And     Discovered endpoint metrics for POST mox /status has 5 requests ({"200": 5})
        And     Discovered interceptor metrics has 2 interceptors ({"lunar-aiohttp-interceptor": "2.1.2", "unknown": "unknown"})
