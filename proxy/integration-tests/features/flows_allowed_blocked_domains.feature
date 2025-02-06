@flows
Feature: Domain lists with flows

    Scenario: Domain access control works with flows
        Given   Lunar Proxy is down
        And     API Provider is up
        And     Lunar Proxy env var `LUNAR_STREAMS_ENABLED` set to `true`
        And     Lunar Proxy is up
        
        When    Domain Access Control flow created with allowed jsonplaceholder.typicode.com and blocking header value x-domain-access=block-me
        And     flow file is saved
        And     load_flows command is run

        # Waiting for the metrics to be updated
        When     wait 2 seconds
        
        When    Request to https:// jsonplaceholder.typicode.com /posts is made through Lunar Proxy
        Then    Response has status 200

        Then     There is a counter named lunar_filter_processor_hit_count with the value 1
        And     There is a counter named lunar_filter_processor_miss_count with the value 1
        
        When    A request to https:// jsonplaceholder.typicode.com /posts is made to proxy with header 'x-domain-access: allow-me'
        Then    Response has status 200

        And     There is a counter named lunar_filter_processor_hit_count with the value 2
        And     There is a counter named lunar_filter_processor_miss_count with the value 2
        
        When    A request to https:// jsonplaceholder.typicode.com /posts is made to proxy with header 'x-domain-access: block-me'
        Then    Response has status 403

        When    Request to https:// example.com / is made through Lunar Proxy
        Then    Response has status 403

    Scenario: Flows When allowed domain specified only it is accessible
        Given   Lunar Proxy env var `TLS_PASSTHROUGH_ON` set to `true`
        And     Lunar Proxy env var `LUNAR_STREAMS_ENABLED` set to `true`
        And     Lunar Proxy is up
        And     API Provider is up
        When    Flow configuration is used
        And     gateway_config.yaml included allowed_domains list with jsonplaceholder.typicode.com
        And     Flow configuration is saved
        And     load_flows command is run
        And     wait 1 seconds
        When    Request to https:// jsonplaceholder.typicode.com /posts is made through Lunar Proxy
        Then    Response has status 200
        When    Request to https:// example.com / is made through Lunar Proxy
        Then    Response has status 403
        When    Request to https:// jsonplaceholder.typicode.com /posts is made through Lunar Proxy TLS Passthrough
        Then    Response has status 200
        When    Request to https:// example.com / is made through Lunar Proxy TLS Passthrough
        Then    Response has status 403
    
    Scenario:  Flows Allowed domain isn't specified - all domains are accessible
        Given   Lunar Proxy env var `TLS_PASSTHROUGH_ON` set to `true`
        And     Lunar Proxy env var `LUNAR_STREAMS_ENABLED` set to `true`
        And     Lunar Proxy is up
        And     API Provider is up
        When    Flow configuration is used
        And     Flow configuration is saved
        And     load_flows command is run
        And     wait 1 seconds
        When    Request to https:// jsonplaceholder.typicode.com /posts is made through Lunar Proxy
        Then    Response has status 200
        When    Request to https:// example.com / is made through Lunar Proxy
        Then    Response has status 200
        When    Request to https:// jsonplaceholder.typicode.com /posts is made through Lunar Proxy TLS Passthrough
        Then    Response has status 200
        When    Request to https:// example.com / is made through Lunar Proxy TLS Passthrough
        Then    Response has status 200

    Scenario: Flows allowed domain specified as any - all domains are accessible
        Given   Lunar Proxy env var `TLS_PASSTHROUGH_ON` set to `true`
        And     Lunar Proxy env var `LUNAR_STREAMS_ENABLED` set to `true`
        And     Lunar Proxy is up
        And     API Provider is up
        When    Flow configuration is used
        And     gateway_config.yaml included allowed_domains list with .*
        And     load_flows command is run
        And     wait 1 seconds
        When    Request to https:// jsonplaceholder.typicode.com /posts is made through Lunar Proxy
        Then    Response has status 200
        When    Request to https:// example.com / is made through Lunar Proxy
        Then    Response has status 200
        When    Request to https:// jsonplaceholder.typicode.com /posts is made through Lunar Proxy TLS Passthrough
        Then    Response has status 200
        When    Request to https:// example.com / is made through Lunar Proxy TLS Passthrough
        Then    Response has status 200

    Scenario: Flows when blocked domain specified it is inaccessible, other domains can be accessed
        Given   Lunar Proxy env var `TLS_PASSTHROUGH_ON` set to `true`
        And     Lunar Proxy env var `LUNAR_STREAMS_ENABLED` set to `true`
        And     Lunar Proxy is up
        And     API Provider is up
        When    Flow configuration is used
        And     gateway_config.yaml included blocked_domains list with example.com
        And     Flow configuration is saved
        And     load_flows command is run
        And     wait 1 seconds
        When    Request to https:// example.com / is made through Lunar Proxy
        Then    Response has status 403
        When    Request to https:// jsonplaceholder.typicode.com /posts is made through Lunar Proxy
        Then    Response has status 200
        When    Request to https:// example.com / is made through Lunar Proxy TLS Passthrough
        Then    Response has status 403
        When    Request to https:// jsonplaceholder.typicode.com /posts is made through Lunar Proxy TLS Passthrough
        Then    Response has status 200
        