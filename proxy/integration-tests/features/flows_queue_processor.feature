@secondaryTests
Feature: Lunar Proxy - Flows - Queue Processor
    Background: Starts the Proxy
        Given   API Provider is up
        And     Lunar Proxy env var `LUNAR_STREAMS_ENABLED` set to `true`
        And     Lunar Proxy is up

    @flakey
    Scenario: Flow delayed Processing with Requests That Timeout
        When    Queue flow created for GET httpbinmock /anything/foo requests with 2 requests per 1 seconds with queue args: ttl=2,queue_size=10
        And     flow file is saved
        And     resource file is saved

        And     load_flows command is run

        # And   next epoch-based 1 seconds window arrives
        And   10 requests are sent in parallel to httpbinmock /anything/foo through Lunar Proxy
        
        # 2 requests allowed - first 2 requests are processed 
        Then  requests 1, 2 are performed within window 1 returning status 200
        # 2 requests waiting in queue for next window
        And   requests 3, 4 are performed within window 2 returning status 200
        # 2 requests waiting in queue for next window
        And   requests 5, 6 are performed within window 3 returning status 200
        # Since the queue's TTL is defined to be 2 seconds,
        # Any request which takes more than 2 seconds will result in 429
        And   requests 7, 8 are performed within 2 to 3 seconds returning status 429
        And   requests 9, 10 are performed within 2 to 3 seconds returning status 429

    @flakey
    Scenario: Flow drop requests when the maximum queue size is reached
        When    Queue flow created for GET httpbinmock /anything/foo requests with 1 requests per 10 seconds with queue args: ttl=2,queue_size=2
        And     flow file is saved
        And     resource file is saved

        And     load_flows command is run

        And   10 requests are sent in parallel to httpbinmock /anything/foo through Lunar Proxy
        Then  1 requests returning with status 200 and 9 with 429

    @flakey
    Scenario: Flow prioritized Delayed Processing
        When    Queue flow created for GET httpbinmock /anything/bar requests with 2 requests per 1 seconds with queue args: ttl=5,queue_size=10,group_by_header=X-Env,groups={"production": 1, "staging": 2}
        And     flow file is saved
        And     resource file is saved

        And     load_flows command is run

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