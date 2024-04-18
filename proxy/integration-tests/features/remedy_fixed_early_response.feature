@mainTests
Feature: Lunar Proxy fixed early response remedy
    Scenario Outline: Lunar returns a fixed early response when policy is matched and Early-Response header is true
        Given   API Provider is up
        And     Lunar Proxy is up
        When    policies.yaml file is updated
        And     policies.yaml includes a fixed_response remedy for GET mox /uuid/* requests with status code <status>
        And     policies.yaml includes a fixed_response remedy for GET mox /uuid/{someID} requests with status code <status>
        And     policies.yaml includes a fixed_response remedy for GET mox /test/* requests with status code <status>
        And     policies.yaml file is saved
        And     apply_policies command is run without waiting for Fluent to reload
        When    A request to <scheme>:// <host> :<port> <path> is made through Lunar Proxy with header 'Early-Response: true'
        Then    Fixed response is returned with status code <status>

        Examples:
            | scheme | host | port   | path              | status |
            | http   | mox  | 8888   | /uuid             | 418    |
            | http   | mox  | 8888   | /uuid/1234        | 202    |
            | http   | mox  | 8888   | /test/prefix/path | 504    |
    
    Scenario: Lunar returns a fixed early response when policy is enabled
        Given   API Provider is up
        And     Lunar Proxy is up
        When    policies.yaml file is updated
        And     policies.yaml includes an accounts section with 2 accounts
        And     policies.yaml includes a fixed_response remedy for GET mox /uuid requests with status code 418
        And     policies.yaml includes a disabled account_orchestration remedy for GET mox /uuid requests
        And     policies.yaml file is saved
        And     apply_policies command is run without waiting for Fluent to reload
        When    A request to http:// mox :8888 /uuid is made through Lunar Proxy with header 'Early-Response: true'
        Then    Fixed response is returned with status code 418

    Scenario: Lunar doesn't return a fixed early response when policy is not matched
        Given   API Provider is up
        And     Lunar Proxy is up
        When    A request to http:// mox :8888 /unmatched/path is made through Lunar Proxy with header 'Early-Response: true'
        And     A request to http:// mox :8888 /unmatched/path is made directly to API Provider with header 'Early-Response: true'
        Then    Responses have the same body and status

    Scenario: Lunar returns response from provider when Early-Response header is false
        Given   Lunar Proxy is up
        When    A request is made through Lunar Proxy with header 'Early-Response: false'
        And     A request is made directly to API Provider with header 'Early-Response: false'
        Then    Responses have the same body and status
