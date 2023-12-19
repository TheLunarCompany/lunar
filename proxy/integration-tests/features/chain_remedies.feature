Feature: Chain multiple remedies
    Scenario: Modifying a request is prioritized over a no-op
        Given   API Provider is up
        And     Lunar Proxy is up
        When    policies.yaml file is updated
        And     policies.yaml includes a fixed_response remedy for GET httpbinmock /headers requests with status code 418
        And     policies.yaml includes an accounts section with 2 accounts
        And     policies.yaml includes a enabled account_orchestration remedy for GET httpbinmock /headers requests
        And     policies.yaml file is saved
        And     apply_policies command is run without waiting for Fluent to reload
        And     4 requests are sent to httpbinmock /headers through Lunar Proxy
        Then    1 and 3 requests are sent with the 1 account
        And     2 and 4 requests are sent with the 2 account

    Scenario: Obtaining a response is prioritized over modifying a request
        Given   API Provider is up
        And     Lunar Proxy is up
        When    policies.yaml file is updated
        And     policies.yaml includes an accounts section with 2 accounts
        And     policies.yaml includes a enabled account_orchestration remedy for GET httpbinmock /headers requests
        And     policies.yaml includes a fixed_response remedy for GET httpbinmock /headers requests with status code 418
        And     policies.yaml file is saved
        And     apply_policies command is run without waiting for Fluent to reload
        And     A request to http:// httpbinmock :80 /headers is made through Lunar Proxy with header 'Early-Response: true'
        Then    Response has status 418

    Scenario: When there are multiple obtained responses, the first response is prioritized
        Given   API Provider is up
        And     Lunar Proxy is up
        When    policies.yaml file is updated
        And     policies.yaml includes a fixed_response remedy for GET httpbinmock /headers requests with status code 418
        And     policies.yaml includes a strategy_based_throttling remedy for GET httpbinmock /headers requests with 0 requests per 1 seconds
        And     policies.yaml file is saved
        And     apply_policies command is run without waiting for Fluent to reload
        And     A request to http:// httpbinmock :80 /headers is made through Lunar Proxy with header 'Early-Response: true'
        Then    Fixed response is returned with status code 418

    Scenario: When there are multiple obtained responses, the first response is prioritized
        Given   API Provider is up
        And     Lunar Proxy is up
        When    policies.yaml file is updated
        And     policies.yaml includes a strategy_based_throttling remedy for GET httpbinmock /headers requests with 2 requests per 1 seconds
        And     policies.yaml includes a fixed_response remedy for GET httpbinmock /headers requests with status code 418
        And     policies.yaml file is saved
        And     apply_policies command is run without waiting for Fluent to reload
        And     3 requests are sent to httpbinmock /headers through Lunar Proxy with Early-Response header set to true
        Then    Responses have 418, 418, 429 status codes in order

    Scenario: There is an early response available upon request that also requires response modification
        Given   API Provider is up
        And     Lunar Proxy is up
        When    policies.yaml file is updated
        And     policies.yaml includes a fixed_response remedy for GET httpbinmock /headers requests with status code 418
        And     policies.yaml includes retry remedy for GET httpbinmock /headers requests with attempts=3, initial_cooldown_seconds=5 and cooldown_multiplier=2
        And     policies.yaml file is saved
        And     apply_policies command is run
        And     A request to http:// httpbinmock :80 /headers is made through Lunar Proxy with header 'Early-Response: true'
        Then    Fixed response is returned with status code 418
        And     Response has x-lunar-retry-after header with value 5
