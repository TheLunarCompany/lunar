@legacy
Feature: Validate Lunar Proxy add the x-lunar-generated on modified responses
    Background: Starts the Proxy
        Given   API Provider is up
        And     Lunar Proxy is up

    Scenario Outline: Lunar returns a fixed early response when policy is matched and x-lunar-generated header is true
        When    policies.yaml file is updated
        And     policies.yaml includes a fixed_response remedy for GET mox /uuid/* requests with status code <status>
        And     policies.yaml includes a fixed_response remedy for GET mox /uuid/{someID} requests with status code <status>
        And     policies.yaml includes a fixed_response remedy for GET mox /test/* requests with status code <status>
        And     policies.yaml file is saved
        And     apply_policies command is run without waiting for Fluent to reload
        When    A request to <scheme>:// <host> :<port> <path> is made through Lunar Proxy with header 'Early-Response: true'
        Then    Response has x-lunar-generated header with value true

        Examples:
            | scheme | host | port   | path              | status |
            | http   | mox  | 8888   | /uuid             | 418    |
            | http   | mox  | 8888   | /uuid/1234        | 202    |
            | http   | mox  | 8888   | /test/prefix/path | 504    |
    
    Scenario: Requests which dont exceed the limit per endpoint defined by the remedy and headers does not have x-lunar-generated header key
        When  policies.yaml file is updated
        And   policies.yaml includes a strategy_based_throttling remedy for GET httpbinmock /anything/* requests with 10 requests per 1 seconds
        And   policies.yaml file is saved
        And   apply_policies command is run without waiting for Fluent to reload
        And   2 requests are sent to httpbinmock /anything/foo through Lunar Proxy
        And   1 requests are sent to httpbinmock /anything/bar through Lunar Proxy
        
        Then Responses does not have x-lunar-generated header
