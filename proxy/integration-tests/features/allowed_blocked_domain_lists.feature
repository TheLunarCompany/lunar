@legacy
Feature: Domain lists
    Scenario: When allowed domain specified only it is accessible
        Given   Lunar Proxy env var `TLS_PASSTHROUGH_ON` set to `true`
        And     Lunar Proxy is up
        And     API Provider is up
        When    policies.yaml file is updated
        And     policies.yaml included allowed_domains list with jsonplaceholder.typicode.com
        And     policies.yaml file is saved
        And     apply_policies command is run
        When    Request to https:// jsonplaceholder.typicode.com /posts is made through Lunar Proxy
        Then    Response has status 200
        When    Request to https:// example.com / is made through Lunar Proxy
        Then    Response has status 403
        When    Request to https:// jsonplaceholder.typicode.com /posts is made through Lunar Proxy TLS Passthrough
        Then    Response has status 200
        When    Request to https:// example.com / is made through Lunar Proxy TLS Passthrough
        Then    Response has status 403
    
    Scenario: Allowed domain isn't specified - all domains are accessible
        Given   Lunar Proxy env var `TLS_PASSTHROUGH_ON` set to `true`
        And     Lunar Proxy is up
        And     API Provider is up
        When    policies.yaml file is updated
        And     policies.yaml file is saved
        And     apply_policies command is run
        When    Request to https:// jsonplaceholder.typicode.com /posts is made through Lunar Proxy
        Then    Response has status 200
        When    Request to https:// example.com / is made through Lunar Proxy
        Then    Response has status 200
        When    Request to https:// jsonplaceholder.typicode.com /posts is made through Lunar Proxy TLS Passthrough
        Then    Response has status 200
        When    Request to https:// example.com / is made through Lunar Proxy TLS Passthrough
        Then    Response has status 200

    Scenario: Allowed domain specified as any - all domains are accessible
        Given   Lunar Proxy env var `TLS_PASSTHROUGH_ON` set to `true`
        And     Lunar Proxy is up
        And     API Provider is up
        When    policies.yaml file is updated
        And     policies.yaml included allowed_domains list with .*
        And     policies.yaml file is saved
        And     apply_policies command is run
        When    Request to https:// jsonplaceholder.typicode.com /posts is made through Lunar Proxy
        Then    Response has status 200
        When    Request to https:// example.com / is made through Lunar Proxy
        Then    Response has status 200
        When    Request to https:// jsonplaceholder.typicode.com /posts is made through Lunar Proxy TLS Passthrough
        Then    Response has status 200
        When    Request to https:// example.com / is made through Lunar Proxy TLS Passthrough
        Then    Response has status 200

    Scenario: When blocked domain specified it is inaccessible, other domains can be accessed
        Given   Lunar Proxy env var `TLS_PASSTHROUGH_ON` set to `true`
        And     Lunar Proxy is up
        And     API Provider is up
        When    policies.yaml file is updated
        And     policies.yaml included blocked_domains list with example.com
        And     policies.yaml file is saved
        And     apply_policies command is run
        When    Request to https:// example.com / is made through Lunar Proxy
        Then    Response has status 403
        When    Request to https:// jsonplaceholder.typicode.com /posts is made through Lunar Proxy
        Then    Response has status 200
        When    Request to https:// example.com / is made through Lunar Proxy TLS Passthrough
        Then    Response has status 403
        When    Request to https:// jsonplaceholder.typicode.com /posts is made through Lunar Proxy TLS Passthrough
        Then    Response has status 200
        