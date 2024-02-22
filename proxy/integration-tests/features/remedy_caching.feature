@mainTests
Feature: Lunar Proxy caching remedy
    Scenario: Response from the provider is stored in cache and retrieved when requested again
        Given   API Provider is up
        And     Lunar Proxy is up
        When    policies.yaml file is updated
        And     policies.yaml includes caching remedy for Get httpbinmock /bytes/{language} requests for language path_params with ttl of 1 second, 1024 max record size bytes and 1 max cache size megabytes
        And     policies.yaml file is saved
        And     apply_policies command is run without waiting for Fluent to reload
        And     wait 1 seconds
        And     1 request to endpoint https:// httpbinmock /bytes/5 is made via Lunar Proxy
        Then    responses 1 and 2 have same value
        Then    responses 2 and 3 have different value
        