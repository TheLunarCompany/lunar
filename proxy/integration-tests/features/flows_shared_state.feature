@flows
Feature: Lunar Proxy - rate limit
    Background: Starts the Proxy
        Given   API Provider is up
        And     Lunar Proxy env var `LUNAR_STREAMS_ENABLED` set to `true`
        And     Lunar Proxy env var `REDIS_URL` set to `redis://lunar-redis:6379`
        And     First Shared Lunar Proxy is up
        And     Second Shared Lunar Proxy is up

    @flakey
    Scenario: When basic rate limit flow is loaded and 2 proxies are used, they should share state
        Given     Redis is up

        When    Basic rate limit flow created for httpbinmock/* with 10 requests per 1 seconds
        And     flow file is saved on lunar-proxy-pro-1
        And     flow file is saved on lunar-proxy-pro-2
        And     resource file is saved on lunar-proxy-pro-1
        And     resource file is saved on lunar-proxy-pro-2
        
        And     load_flows command is run on lunar-proxy-pro-1
        And     load_flows command is run on lunar-proxy-pro-2

        And     next epoch-based 1 seconds window arrives

        And     8 requests are sent in parallel to httpbinmock /headers through first Shared Lunar Proxy
        Then    8 requests returning with status 200 and 0 with 429

        # Second proxy runs in shares memory state and its state at this stage is 8
        When    3 requests are sent to httpbinmock /headers through second Shared Lunar Proxy 
        # 10 with 200 and 1 with 429 since second proxy started from 8 
        Then    10 requests returning with status 200 and 1 with 429
