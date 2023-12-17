Feature: Validate Method types using Lunar Interceptor
    Scenario: POST method is supported
        Given Lunar Proxy (logic support) is up
        And export LUNAR_PROXY_HOST=logic-mock-server:9000
        And export LUNAR_HEALTHCHECK_PORT=9000
        And export LUNAR_ALLOW_LIST=httpbinmock
        And client application is running
        When client application makes an outgoing post HTTP call
        Then response from POST will return from Lunar Proxy
