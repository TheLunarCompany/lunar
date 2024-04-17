Feature: Interceptor's Features Tests
    Background: Client configuration
        Given client application is configured with LUNAR_ENTER_COOLDOWN_AFTER_ATTEMPTS=2
        And client application is configured with LUNAR_EXIT_COOLDOWN_AFTER_SEC=4
        And export LUNAR_PROXY_HOST=mox:9898
        And export LUNAR_HANDSHAKE_PORT=9898
        And export LUNAR_ALLOW_LIST=httpbinmock

    Scenario: Lunar Interceptor exit from FailSafe as expected
        Given Lunar Proxy is up
        And client application is running
        And Interceptor enter into FailSafe mode
        When LUNAR_EXIT_COOLDOWN_AFTER_SEC passes, the Interceptor exits the FailSafe mode
        And client application makes an outgoing HTTP call
        Then response will return from Lunar Proxy

    Scenario: Lunar Interceptor the original Provider when the FailSafe is active
        Given client application is running
        And Interceptor enter into FailSafe mode
        When client application makes an outgoing HTTP call
        Then response will return from original provider

    Scenario: Lunar Interceptor the original Provider when the FailSafe is active after Proxy Error
        Given Lunar Proxy is up
        And client application is running
        And Mox path invalid endpoint is set
        And Mox path valid endpoint is set
        And Interceptor enter into FailSafe mode after error from Lunar Proxy
        When client application makes an outgoing HTTP call
        Then response will return from original provider
