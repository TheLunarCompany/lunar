@mainTests
Feature: Lunar Proxy account orchestration remedy
    Scenario: Account orchestration remedy
        Given   Lunar Proxy is up
        And     API Provider is up
        When    policies.yaml file is updated
        And     policies.yaml includes an accounts section with 2 accounts
        And     policies.yaml includes a enabled account_orchestration remedy for GET httpbinmock /headers requests
        And     policies.yaml file is saved
        And     apply_policies command is run without waiting for Fluent to reload
        And     4 requests are sent to httpbinmock /headers through Lunar Proxy
        Then    1 and 3 requests are sent with the 1 account
        And     2 and 4 requests are sent with the 2 account
