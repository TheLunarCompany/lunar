@gateway
Feature: Lunar Hub Integration

    Scenario: Proxy send discovery to Lunar Hub using the WebSocket connection
        Given   API Provider is up
        And     Lunar Hub Mock is up
        And     Lunar Proxy env var `LUNAR_HUB_URL` set to `hub-mock:8088`
        And     Lunar Proxy env var `LUNAR_API_KEY` set to `someRundomValue`
        And     Lunar Proxy is up
        When    A request to http:// httpbinmock :80 /get is made through Lunar Proxy
        Then    Discovery event is sent to Lunar Hub
