@secondaryTests
Feature: Lunar Proxy - rate limit
    Background: Starts the Proxy
        Given   API Provider is up
        And     Lunar Proxy env var `LUNAR_STREAMS_ENABLED` set to `true`
        And     Lunar Proxy is up

    Scenario: When basic rate limit flow is loaded, requests which exceed the defined limit receive a rate limit error response
        When    Basic rate limit flow created for httpbinmock/* with 2 requests per 1 seconds
        And     flow file is saved
        And     resource file is saved

        And     load_flows command is run

        And   next epoch-based 1 seconds window arrives
        And   3 requests are sent to httpbinmock /headers through Lunar Proxy        
        And   next epoch-based 1 seconds window arrives
        And   1 request is sent to httpbinmock /headers through Lunar Proxy
        
        Then Responses have 200, 200, 429, 200 status codes in order

    Scenario: When basic rate limit flow is loaded, requests which exceed the limit per endpoint receive a rate limit error response
        When    Basic rate limit flow created for httpbinmock/anything/* with 2 requests per 1 seconds
        And     flow file is saved with name flow1.yaml
        And     resource file is saved with name flow1_quota.yaml
        And     Basic rate limit flow created for httpbinmock/base64/* with 2 requests per 1 seconds
        And     flow file is saved with name flow2.yaml
        And     resource file is saved with name flow2_quota.yaml
        And     load_flows command is run
        
        And   next epoch-based 1 seconds window arrives

        And   2 requests are sent to httpbinmock /anything/foo through Lunar Proxy
        And   1 requests are sent to httpbinmock /anything/bar through Lunar Proxy
        And   2 requests are sent to httpbinmock /base64/foo through Lunar Proxy
        And   1 requests are sent to httpbinmock /base64/bar through Lunar Proxy
        
        And   next epoch-based 1 seconds window arrives

        And   1 request is sent to httpbinmock /anything/foo through Lunar Proxy
        And   1 request is sent to httpbinmock /base64/foo through Lunar Proxy
        
        Then Responses have 200, 200, 429, 200, 200, 429, 200, 200 status codes in order

    Scenario: When basic rate limit flow is loaded, Requests which exceed the limit uses spillover when enabled
        When  Basic rate limit flow created for httpbinmock/anything/* with 2 requests per 1 seconds and spillover with max of 3
        And   flow file is saved with name flow1.yaml
        And   resource file is saved with name flow1_quota.yaml
        And     load_flows command is run
        And   next epoch-based 1 seconds window arrives

        And   1 request is sent to httpbinmock /anything/foo through Lunar Proxy
        
        And   next epoch-based 1 seconds window arrives

        And   3 requests are sent to httpbinmock /anything/bar through Lunar Proxy
        And   1 request is sent to httpbinmock /anything/foo through Lunar Proxy
        
        Then Responses have 200, 200, 200, 200, 429 status codes in order