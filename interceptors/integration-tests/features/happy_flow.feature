Feature: Interceptor's happy flow
    Scenario Outline: Lunar Proxy is responsive
        Given Lunar Proxy is up
        And export LUNAR_PROXY_HOST=mox:9898
        And export LUNAR_HANDSHAKE_PORT=9898
        And export LUNAR_ALLOW_LIST=httpbinmock
        And client application is running
        And Mox path valid endpoint is set
        When client application makes an outgoing HTTP call
        Then response will return from Lunar Proxy
