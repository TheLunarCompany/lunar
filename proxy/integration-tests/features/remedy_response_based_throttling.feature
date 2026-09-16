@legacy
Feature: Lunar Proxy response-based throttling remedy
    Scenario: Rate limited requests are stored and served by Lunar Proxy until the end of the rate limit window
        Given   API Provider is up
        And     Lunar Proxy is up
        And     2 remaining requests until rate limit threshold is reached
        When    policies.yaml file is updated
        And     policies.yaml includes a response_based_throttling remedy for GET mox:8888 /throttle requests for 429 status using retry-after header as relative_seconds 
        And     policies.yaml file is saved
        And     apply_policies command is run without waiting for Fluent to reload
        And     4 requests to rate limited endpoint http:// mox :8888 /throttle are made via Lunar Proxy
        And     current rate limit window passes
        And     1 request to rate limited endpoint http:// mox :8888 /throttle is made via Lunar Proxy
        Then    first 2 responses have status 200
        And     3rd & 4th response have status 429 and their body is the same
        And     5th response has status 200
