Feature: Call sequences are supported using x-lunar-sequence-id header
    Scenario: Interceptor respect x-lunar-retry-after header by sleeping its value
        Given Lunar Proxy (logic support) is up
        And export LUNAR_PROXY_HOST=logic-mock-server:9000
        And export LUNAR_HEALTHCHECK_PORT=9000
        And export LUNAR_ALLOW_LIST=httpbinmock
        And client application is running
        And Lunar Proxy (logic support) will return `x-lunar-retry-after` header with value `0.5` for 2 times
        When client application makes an outgoing HTTP call to retryable endpoint
        Then total sequence time should be around 1.0 seconds (with a delta of ~ 0.2 seconds)

    Scenario: Interceptor makes subsequent calls as long as x-lunar-retry-after header is found
        Given Lunar Proxy (logic support) is up
        Given export LUNAR_PROXY_HOST=logic-mock-server:9000
        And export LUNAR_HEALTHCHECK_PORT=9000
        And export LUNAR_ALLOW_LIST=httpbinmock
        And client application is running
        And Lunar Proxy (logic support) will return `x-lunar-retry-after` header with value `0.1` for 3 times
        When client application makes an outgoing HTTP call to retryable endpoint
        Then Lunar proxy (logic support) should have receive a total of 4 calls
