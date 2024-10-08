@secondaryTests
Feature: Lunar Proxy - rate limit
    Background: Starts the Proxy
        Given   Lunar Proxy is down
        And     API Provider is up
        And     Lunar Proxy env var `LUNAR_STREAMS_ENABLED` set to `true`
        And     Lunar Proxy is up
   
    Scenario: When basic rate limit flow is active, quota metrics shows limit and used value
        When    Basic rate limit flow created for httpbinmock/* with 5 requests per 1 seconds
        And     flow file is saved
        And     resource file is saved

        And     load_flows command is run

        And     next epoch-based 1 seconds window arrives
        And     4 requests are sent to httpbinmock /headers through Lunar Proxy        
       
        Then    There is a counter named lunar_resources_quota_resource_quota_limit with the value 5
        And     There is a counter named lunar_resources_quota_resource_quota_used with the value 4
        And     There is a counter named active_flows with the value 1
        And     There is a counter named flow_invocations with the value 4
        And     There is a counter named requests_through_flows with the value 4
        And     There is a gauge avg_flow_execution_time with the value larger than 0
        And     There is a gauge avg_processor_execution_time with the value larger than 0
        

