@flows
Feature: Lunar Proxy - rate limit

    @flakey
    Scenario: When basic rate limit flow is loaded, requests which exceed the defined limit receive a rate limit error response
        Given   Lunar Proxy is down
        And     API Provider is up
        And     Lunar Proxy env var `LUNAR_STREAMS_ENABLED` set to `true`
        And     Lunar Proxy is up
        When    Basic rate limit flow created for httpbinmock/* with 2 requests per 1 seconds
        And     flow file is saved
        And     resource file is saved

        And     load_flows command is run

        And   next epoch-based 1 seconds window arrives
        And   3 requests are sent to httpbinmock /headers through Lunar Proxy        
        And   next epoch-based 1 seconds window arrives
        And   1 request is sent to httpbinmock /headers through Lunar Proxy
        
        Then Responses have 200, 200, 429, 200 status codes in order

    # case where url is host without path and filter ends with a wildcard, for example: url: "host.com", filter: "host.com/*" (CORE-1443)    
    Scenario: When basic rate limit flow is loaded and requests being sent to host only, requests which exceed the defined limit receive a rate limit error response
        Given   Lunar Proxy is down
        And     API Provider is up
        And     Lunar Proxy env var `LUNAR_STREAMS_ENABLED` set to `true`
        And     Lunar Proxy is up
        When    Basic rate limit flow created for httpbinmock/* with 5 requests per 10 seconds
        And     flow file is saved
        And     resource file is saved

        And     load_flows command is run

        And   next epoch-based 1 seconds window arrives
        And   6 requests are sent to httpbinmock / through Lunar Proxy        
        
        Then Responses have 200, 200, 200, 200, 200, 429 status codes in order

    Scenario: When basic rate limit flow is loaded, requests which exceed the limit per endpoint receive a rate limit error response
        Given   Lunar Proxy is down
        And   API Provider is up
        And     Lunar Proxy env var `LUNAR_STREAMS_ENABLED` set to `true`
        And     Lunar Proxy is up
        And     Fixed Window parent for httpbinmock/anything/* with ID: rateLimit1 and 2 requests per 1 second added to flow_quota.yaml
        And     Fixed Window parent for httpbinmock/base64/* with ID: rateLimit2 and 2 requests per 1 second added to flow_quota.yaml
        When    Quota file flow_quota.yaml is saved
        And     Basic rate limit flow created for httpbinmock/anything/* linked to quota ID: rateLimit1
        And     flow file is saved with name flow1.yaml
        And     Basic rate limit flow created for httpbinmock/base64/* linked to quota ID: rateLimit2
        And     flow file is saved with name flow2.yaml
        And     load_flows command is run
        
    #     And   next epoch-based 1 seconds window arrives

    #     And   2 requests are sent to httpbinmock /anything/foo through Lunar Proxy
    #     And   1 requests are sent to httpbinmock /anything/bar through Lunar Proxy
    #     And   2 requests are sent to httpbinmock /base64/foo through Lunar Proxy
    #     And   1 requests are sent to httpbinmock /base64/bar through Lunar Proxy
        
    #     And   next epoch-based 1 seconds window arrives

    #     And   1 request is sent to httpbinmock /anything/foo through Lunar Proxy
    #     And   1 request is sent to httpbinmock /base64/foo through Lunar Proxy
        
    #     Then Responses have 200, 200, 429, 200, 200, 429, 200, 200 status codes in order

    # We need to re-enable this test after fixing the issue with the spillover
    
    # @flakey
    # Scenario: When basic rate limit flow is loaded, Requests which exceed the limit uses spillover when enabled
    #     Given   Lunar Proxy is down
    #     And     API Provider is up
    #     And     Lunar Proxy env var `LUNAR_STREAMS_ENABLED` set to `true`
    #     And     Lunar Proxy is up
    #     When  Basic rate limit flow created for httpbinmock/anything/* with 2 requests per 1 seconds and spillover with max of 3
    #     And   flow file is saved with name flow1.yaml
    #     And   resource file is saved with name flow1_quota.yaml
    #     And     load_flows command is run
    #     And   next epoch-based 1 seconds window arrives

    #     And   1 request is sent to httpbinmock /anything/foo through Lunar Proxy
        
    #     And   next epoch-based 1 seconds window arrives

    #     And   3 requests are sent to httpbinmock /anything/bar through Lunar Proxy
    #     And   1 request is sent to httpbinmock /anything/foo through Lunar Proxy
        
    #     Then Responses have 200, 200, 200, 200, 429 status codes in order