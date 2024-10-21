@mainTests
Feature: Lunar Proxy retry remedy
    Scenario: Response doesn't require retry
        Given   Lunar Proxy is up
        And     API Provider is up
        When    policies.yaml file is updated
        And     policies.yaml includes retry remedy for GET httpbinmock /status/* requests with attempts=3, initial_cooldown_seconds=5 and cooldown_multiplier=2
        And     policies.yaml file is saved
        And     apply_policies command is run without waiting for Fluent to reload
        And     Request to http:// httpbinmock :80 /status/200 is made through Lunar Proxy
        Then    Response has status 200
        And     Response does not have x-lunar-retry-after header

    Scenario: Response requires retry
        Given   Lunar Proxy is up
        And     API Provider is up
        When    policies.yaml file is updated
        And     policies.yaml includes retry remedy for GET httpbinmock /status/* requests with attempts=3, initial_cooldown_seconds=5 and cooldown_multiplier=2
        And     policies.yaml file is saved
        And     apply_policies command is run without waiting for Fluent to reload
        And     A request to http:// httpbinmock :80 /status/500 is made through Lunar Proxy
        Then    Response has status 500
        And     Response has x-lunar-retry-after header with value 5

    Scenario: Response requires retry and retry succeeds
        Given   Lunar Proxy is up
        And     API Provider is up
        When    policies.yaml file is updated
        And     policies.yaml includes retry remedy for GET httpbinmock /status/* requests with attempts=3, initial_cooldown_seconds=5 and cooldown_multiplier=2
        And     policies.yaml file is saved
        And     apply_policies command is run without waiting for Fluent to reload
        And     A request to http:// httpbinmock :80 /status/500 is made through Lunar Proxy
        And     A request to http:// httpbinmock :80 /status/200 is made through Lunar Proxy with previously returned sequence id
        Then    Response has status 200
        And     Response does not have x-lunar-retry-after header

Scenario: Retry attempts are exhausted
        Given   Lunar Proxy is up
        And     API Provider is up
        When    policies.yaml file is updated
        And     policies.yaml includes retry remedy for GET httpbinmock /status/* requests with attempts=3, initial_cooldown_seconds=5 and cooldown_multiplier=2
        And     policies.yaml file is saved
        And     apply_policies command is run without waiting for Fluent to reload
        And     A request to http:// httpbinmock :80 /status/500 is made through Lunar Proxy
        And     A request to http:// httpbinmock :80 /status/400 is made through Lunar Proxy with previously returned sequence id
        And     A request to http:// httpbinmock :80 /status/401 is made through Lunar Proxy with previously returned sequence id
        And     A request to http:// httpbinmock :80 /status/429 is made through Lunar Proxy with previously returned sequence id
        Then    Response has status 429
        And     Response does not have x-lunar-retry-after header
