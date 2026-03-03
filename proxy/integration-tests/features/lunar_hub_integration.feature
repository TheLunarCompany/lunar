@gateway
Feature: Lunar Hub Integration
    Scenario: Proxy send discovery to Lunar Hub using the WebSocket connection
        Given   Lunar Proxy is down
        And     API Provider is up
        And     Lunar Hub Mock is up
        And     Lunar Proxy env var `LUNAR_HUB_URL` set to `hub-mock:8088`
        And     Lunar Proxy env var `LUNAR_API_KEY` set to `someRandomValue`
        And     Lunar Proxy env var `LUNAR_STREAMS_ENABLED` set to `true`
        And     Lunar Proxy is up
        When    A request to http:// httpbinmock :80 /get is made through Lunar Proxy
        Then    Discovery event is sent to Lunar Hub

    Scenario: Proxy send discovery to Lunar Hub using the WebSocket connection even if Hub is not available at boot
        Given   Lunar Proxy is down
        And     API Provider is up
        And     Lunar Hub Mock is down
        And     Lunar Proxy env var `LUNAR_HUB_URL` set to `hub-mock:8088`
        And     Lunar Proxy env var `LUNAR_API_KEY` set to `someRandomValue`
        And     Lunar Proxy env var `LUNAR_STREAMS_ENABLED` set to `true`
        And     Lunar Proxy is up
        And     Lunar Hub Mock is up
        When    A request to http:// httpbinmock :80 /get is made through Lunar Proxy
        Then    Discovery event is sent to Lunar Hub

    Scenario: Proxy send configuration to Lunar Hub using the WebSocket connection
        Given   Lunar Proxy is down
        And     API Provider is up
        And     Lunar Hub Mock is up
        And     Lunar Proxy env var `LUNAR_HUB_URL` set to `hub-mock:8088`
        And     Lunar Proxy env var `LUNAR_API_KEY` set to `someRandomValue`
        And     Lunar Proxy env var `LUNAR_STREAMS_ENABLED` set to `true`
        And     Lunar Proxy is up
        Then    Configuration Load event is sent to Lunar Hub

    Scenario: Proxy send initial configuration to Lunar Hub using the WebSocket connection even if Hub is not available at boot
        Given   Lunar Proxy is down
        And     API Provider is up
        And     Lunar Hub Mock is down
        And     Lunar Proxy env var `LUNAR_HUB_URL` set to `hub-mock:8088`
        And     Lunar Proxy env var `LUNAR_API_KEY` set to `someRandomValue`
        And     Lunar Proxy env var `LUNAR_STREAMS_ENABLED` set to `true`
        And     Lunar Proxy is up
        And     Lunar Hub Mock is up
        Then    Configuration Load event is sent to Lunar Hub

    Scenario: Proxy send metrics to Lunar Hub using the WebSocket connection
        Given   Lunar Proxy is down
        And     API Provider is up
        And     Lunar Hub Mock is up
        And     Lunar Proxy env var `LUNAR_HUB_URL` set to `hub-mock:8088`
        And     Lunar Proxy env var `HUB_METRICS_REPORT_INTERVAL` set to `1`
        And     Lunar Proxy env var `LUNAR_API_KEY` set to `someRandomValue`
        And     Lunar Proxy env var `LUNAR_STREAMS_ENABLED` set to `true`
        And     Lunar Proxy is up
        When    A request to http:// httpbinmock :80 /get is made through Lunar Proxy
        Then    Metrics event is sent to Lunar Hub

    Scenario: Proxy send metrics to Lunar Hub using the WebSocket connection even if Hub is not available at boot
        Given   Lunar Proxy is down
        And     API Provider is up
        And     Lunar Hub Mock is down
        And     Lunar Proxy env var `LUNAR_HUB_URL` set to `hub-mock:8088`
        And     Lunar Proxy env var `HUB_METRICS_REPORT_INTERVAL` set to `1`
        And     Lunar Proxy env var `LUNAR_API_KEY` set to `someRandomValue`
        And     Lunar Proxy env var `LUNAR_STREAMS_ENABLED` set to `true`
        And     Lunar Proxy is up
        And     Lunar Hub Mock is up
        When    A request to http:// httpbinmock :80 /get is made through Lunar Proxy
        Then    Metrics event is sent to Lunar Hub
