@gateway
Feature: Graceful Shutdown
    Scenario Outline: Shutdown while there is a request in transit
        Given   Lunar Proxy is down
        And     Lunar Proxy is up
        And     API Provider is up
        When    Request is made through Lunar Proxy to a high-latency provider
        And     Lunar Proxy is stopped gracefully with <signal> before response is obtained
        And     wait 0.5 seconds
        And     Another request is made after graceful shutdown started
        Then    The response for the request pre-shutdown is 200
        # We expect the post signal request to fail (this is why the response is 503 - 'Lunar Gateway is shuting down')
        And     The response for request post-shutdown is 503
        
        Examples:
            | signal   |
            | SIGINT   |
            | SIGTERM  |
