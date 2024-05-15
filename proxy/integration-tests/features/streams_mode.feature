@secondaryTests
Feature: Lunar Proxy - streams mode
    Scenario: When streams enabled request passes through Lunar Proxy
        Given   API Provider is up
        And     Lunar Proxy env var `LUNAR_STREAMS_ENABLED` set to `true`
        And     Lunar Proxy is up
        When    Request to http:// mox :8888 /uuid is made through Lunar Proxy
        And     Request to http:// mox :8888 /uuid is made directly to API Provider
        Then    Responses have the same body and status

