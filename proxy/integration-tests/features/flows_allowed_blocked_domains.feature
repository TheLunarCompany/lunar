@secondaryTests
Feature: Domain lists with flows
    Background: Starts the Proxy
        Given   API Provider is up
        And     Lunar Proxy env var `LUNAR_STREAMS_ENABLED` set to `true`
        And     Lunar Proxy is up

    Scenario: Domain access control works with flows
        When    Domain Access Control flow created with allowed jsonplaceholder.typicode.com and blocking header value X-Domain-Access=block-me
        And     flow file is saved
        And     load_flows command is run


        When    Request to https:// jsonplaceholder.typicode.com /posts is made through Lunar Proxy
        Then    Response has status 200
        
        When    A request to https:// jsonplaceholder.typicode.com /posts is made to proxy with header 'X-Domain-Access: allow-me'
        Then    Response has status 200
        
        When    A request to https:// jsonplaceholder.typicode.com /posts is made to proxy with header 'X-Domain-Access: block-me'
        Then    Response has status 403
        
        When    Request to https:// example.com / is made through Lunar Proxy
        Then    Response has status 403
    