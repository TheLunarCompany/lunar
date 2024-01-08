Feature: Lunar Proxy concurrency-based throttling remedy
    Scenario: Concurrency limit is exceeded
        Given   API Provider is up
        And     Lunar Proxy is up
        When    policies.yaml file is updated
        And     policies.yaml includes a concurrency_based_throttling remedy for GET httpbinmock /delay/1 requests with 429 response_status_code and 2 max_concurrent_requests
        And     policies.yaml file is saved
        And     A local POST request (id apply_policies) is made to port 8081 at path /apply_policies
        
        And     3 concurrent requests (group A) to endpoint httpbinmock /delay/1 are made via Lunar Proxy
        And     2 concurrent requests (group B) to endpoint httpbinmock /delay/1 are made via Lunar Proxy
        Then    2 responses from group A have status code 200
        And     1 responses from group A have status code 429
        And     2 responses from group B have status code 200
