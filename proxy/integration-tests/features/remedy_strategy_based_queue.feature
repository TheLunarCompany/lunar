@legacy
Feature: Strategy Based Queue
    @flakey
    Scenario: Delayed Processing with Requests That Timeout
        Given API Provider is up
        And   Lunar Proxy is up
        
        When  policies.yaml file is updated
        And   policies.yaml includes a strategy_based_queue remedy for GET httpbinmock /anything/foo requests with 2 requests per 1 seconds and TTL of 2 seconds and queue_size of 10 resulting in 429 status code
        And   policies.yaml file is saved
        And   apply_policies command is run

        # And   next epoch-based 1 seconds window arrives
        And   10 requests are sent in parallel to httpbinmock /anything/foo through Lunar Proxy
        
        Then  requests 1, 2 are performed within window 1 returning status 200
        And   requests 3, 4 are performed within window 2 returning status 200
        And   requests 5, 6 are performed within window 3 returning status 200
        # Since the queue's TTL is defined to be 2 seconds,
        # Any request which takes more than 2 seconds will result in 429
        And   requests 7, 8 are performed within 2 to 3 seconds returning status 429
        And   requests 9, 10 are performed within 2 to 3 seconds returning status 429

    @flakey
    Scenario: Drop requests when the maximum queue size is reached 
        Given API Provider is up
        And   Lunar Proxy is up
        
        When  policies.yaml file is updated
        And   policies.yaml includes a strategy_based_queue remedy for GET httpbinmock /anything/foo requests with 1 requests per 10 seconds and TTL of 1 seconds and queue_size of 2 resulting in 429 status code
        And   policies.yaml file is saved
        And   apply_policies command is run

        And   10 requests are sent in parallel to httpbinmock /anything/foo through Lunar Proxy
        Then  1 requests returning with status 200 and 9 with 429

    @flakey
    Scenario: Prioritized Delayed Processing
        Given API Provider is up
        And   Lunar Proxy is up
        
        When  policies.yaml file is updated
        And   policies.yaml includes a strategy_based_queue remedy for GET httpbinmock /anything/bar requests with 2 requests per 1 seconds and TTL of 5 seconds and queue_size of 10 resulting in 429 status code with prioritization of production > staging by header X-Env
        And   policies.yaml file is saved
        And   apply_policies command is run

        # And   next epoch-based 1 seconds window arrives
        And   8 requests are sent in parallel to httpbinmock /anything/bar through Lunar Proxy, 4 with X-Env header production and the rest staging
        
        # We can only assert on the non-immediate window, as no prioritization
        # occurs on the current window.
        Then   requests 3, 4 have production X-Env header
        # In this scenario, we can only be certain that staging requests take the last
        # two slots.
        And    requests 7, 8 have staging X-Env header

        And   requests 1, 2 are performed within window 1 returning status 200
        And   requests 3, 4 are performed within window 2 returning status 200
        And   requests 5, 6 are performed within window 3 returning status 200
        And   requests 7, 8 are performed within window 4 returning status 200