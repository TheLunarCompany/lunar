Feature: Call sequences are supported using x-lunar-sequence-id header
    Scenario: Call sequence is supported
        Given Lunar Proxy is up
        And export LUNAR_PROXY_HOST=mox:9898
        And export LUNAR_HEALTHCHECK_PORT=9898
        And export LUNAR_ALLOW_LIST=httpbinmock
        And client application is running
        And Lunar proxy returns responses with x-lunar-sequence-id header
        When client application makes an outgoing HTTP call
        Then response will not contain the header x-lunar-sequence-id
