Feature: Proxy is managed, the traffic to be forwarded is determined by the LUNAR_ALLOW_LIST.
   @not_implemented_exclude
    Scenario: The interceptors initiate a handshake with a managed proxy and allow_list == 0
        Given Lunar Proxy (logic support) is up
        And export LUNAR_PROXY_HOST=logic-mock-server:9000
        And export LUNAR_HANDSHAKE_PORT=9000
        And export LUNAR_TENANT_ID=managed
        And client application is running
        When client application makes an outgoing HTTP call
        Then response will return from original provider

    @not_implemented_exclude
    Scenario: The interceptors initiate a handshake with a managed proxy and allow_list > 0
        Given Lunar Proxy (logic support) is up
        And export LUNAR_PROXY_HOST=logic-mock-server:9000
        And export LUNAR_HANDSHAKE_PORT=9000
        And export LUNAR_TENANT_ID=managed
        And export LUNAR_ALLOW_LIST=httpbinmock
        And client application is running
        When client application makes an outgoing HTTP call
        Then response will return from Lunar Proxy
