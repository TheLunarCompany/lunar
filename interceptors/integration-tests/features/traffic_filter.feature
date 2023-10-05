Feature: Interceptor's TrafficFilter Tests
    Scenario: Lunar Proxy is responsive and AllowList is filled
        Given Lunar Proxy is up
        And export LUNAR_PROXY_HOST=mox:9898
        And export LUNAR_HEALTHCHECK_PORT=9898
        And export LUNAR_ALLOW_LIST=httpbinmock
        And client application is running
        And Mox path valid endpoint is set
        When client application makes an outgoing HTTP call
        Then response will return from Lunar Proxy

    Scenario: Lunar Proxy is responsive and BlockList is filled
        Given Lunar Proxy is up
        And export LUNAR_PROXY_HOST=mox:9898
        And export LUNAR_HEALTHCHECK_PORT=9898
        And export LUNAR_BLOCK_LIST=httpbinmock
        And Lunar Proxy is up
        And client application is running
        And Mox path valid endpoint is set
        When client application makes an outgoing HTTP call
        Then response will return from original provider

    @nodejs_exclude
    Scenario: Lunar Proxy is responsive and requests is sent to internal IP
        Given Lunar Proxy is up
        And export LUNAR_PROXY_HOST=mox:9898
        And export LUNAR_HEALTHCHECK_PORT=9898
        And client application is running
        And Mox path valid endpoint is set
        When client application makes an outgoing HTTP call to internal IP
        Then response will return from original provider

    Scenario: Lunar Proxy is responsive and requests is sent to allowed internal IP
        Given Lunar Proxy is up
        And export LUNAR_PROXY_HOST=mox:9898
        And export LUNAR_HEALTHCHECK_PORT=9898
        And export LUNAR_ALLOW_LIST=httpbinmock
        And client application is running
        And Mox path valid endpoint is set
        When client application makes an outgoing HTTP call to internal IP
        Then response will return from Lunar Proxy

    Scenario: Lunar Proxy is responsive and requests is sent with lunar interceptor header
        Given Lunar Proxy (logic support) is up
        And export LUNAR_PROXY_HOST=logic-mock-server:9000
        And export LUNAR_HEALTHCHECK_PORT=9000
        And export LUNAR_ALLOW_LIST=httpbinmock
        And client application is running
        When client application makes an outgoing HTTP request and retrieves the incoming request's HTTP headers
        Then response will return from Lunar Proxy with incoming request's HTTP headers.
