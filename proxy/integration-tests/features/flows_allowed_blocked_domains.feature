@secondaryTests
Feature: Domain lists with flows

    Scenario: Domain access control works with flows
        Given   Lunar Proxy is down
        And     API Provider is up
        And     Lunar Proxy env var `LUNAR_STREAMS_ENABLED` set to `true`
        And     Lunar Proxy is up
        When    Domain Access Control flow created with allowed jsonplaceholder.typicode.com and blocking header value x-Domain-aCCess=block-me
        And     flow file is saved
        And     load_flows command is run


        When    Request to https:// jsonplaceholder.typicode.com /posts is made through Lunar Proxy
        Then    Response has status 200
        And     There is a counter named lunar_filter_processor_hit_count with the value 1
        And     There is a counter named lunar_filter_processor_miss_count with the value 1
        
        When    A request to https:// jsonplaceholder.typicode.com /posts is made to proxy with header 'x-domain-access: allow-me'
        Then    Response has status 200

        And     There is a counter named lunar_filter_processor_hit_count with the value 2
        And     There is a counter named lunar_filter_processor_miss_count with the value 2
        
        When    A request to https:// jsonplaceholder.typicode.com /posts is made to proxy with header 'X-Domain-Access: block-me'
        Then    Response has status 403

        When    Request to https:// example.com / is made through Lunar Proxy
        Then    Response has status 403