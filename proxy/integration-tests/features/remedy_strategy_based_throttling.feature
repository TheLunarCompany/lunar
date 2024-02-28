@mainTests
Feature: Strategy Based Throttling Remedy
    Scenario: Requests which exceed the limit defined by the remedy receive a rate limit error response
        Given API Provider is up
        And   Lunar Proxy is up
        When  policies.yaml file is updated
        And   policies.yaml includes a strategy_based_throttling remedy for GET httpbinmock /headers requests with 2 requests per 1 seconds
        And   policies.yaml file is saved
        And   apply_policies command is run without waiting for Fluent to reload

        And   next epoch-based 1 seconds window arrives
        
        And   3 requests are sent to httpbinmock /headers through Lunar Proxy
        
        And   next epoch-based 1 seconds window arrives

        And   1 request is sent to httpbinmock /headers through Lunar Proxy
        
        Then Responses have 200, 200, 429, 200 status codes in order

    Scenario: Requests which exceed the limit with spillover
        Given API Provider is up
        And   Lunar Proxy is up
        When  policies.yaml file is updated
        And   policies.yaml includes a strategy_based_throttling remedy for GET httpbinmock /anything requests with 2 requests per 1 seconds spillover is enabled
        And   policies.yaml file is saved
        And   apply_policies command is run without waiting for Fluent to reload

        And   next epoch-based 1 seconds window arrives

        And   1 request is sent to httpbinmock /anything through Lunar Proxy
        
        And   next epoch-based 1 seconds window arrives

        And   3 requests are sent to httpbinmock /anything through Lunar Proxy
        And   1 request is sent to httpbinmock /anything through Lunar Proxy
        
        Then Responses have 200, 200, 200, 200, 429 status codes in order

    Scenario: Requests which exceed the limit per endpoint defined by the remedy receive a rate limit error response
        Given API Provider is up
        And   Lunar Proxy is up
        When  policies.yaml file is updated
        And   policies.yaml includes a strategy_based_throttling remedy for GET httpbinmock /anything/* requests with 2 requests per 1 seconds
        And   policies.yaml includes a strategy_based_throttling remedy for GET httpbinmock /base64/{value} requests with 2 requests per 1 seconds
        And   policies.yaml file is saved
        And   apply_policies command is run without waiting for Fluent to reload

        And   next epoch-based 1 seconds window arrives

        And   2 requests are sent to httpbinmock /anything/foo through Lunar Proxy
        And   1 requests are sent to httpbinmock /anything/bar through Lunar Proxy
        And   2 requests are sent to httpbinmock /base64/foo through Lunar Proxy
        And   1 requests are sent to httpbinmock /base64/bar through Lunar Proxy
        
        And   next epoch-based 1 seconds window arrives

        And   1 request is sent to httpbinmock /anything/foo through Lunar Proxy
        And   1 request is sent to httpbinmock /base64/foo through Lunar Proxy
        
        Then Responses have 200, 200, 429, 200, 200, 429, 200, 200 status codes in order

    Scenario: Requests which exceed the quota allocation for their group defined by the remedy receive a rate limit error response
        Given API Provider is up
        And   Lunar Proxy is up
        When  policies.yaml file is updated
        And   policies.yaml includes a strategy_based_throttling remedy for GET httpbinmock /headers requests with 4 requests per 1 seconds grouped by Authorization header with quota_allocations of 25% to "123" and 75% to "456"
        And   policies.yaml file is saved
        And   apply_policies command is run without waiting for Fluent to reload
        
        And   next epoch-based 1 seconds window arrives

        And   4 requests are sent to httpbinmock /headers through Lunar Proxy with Authorization header set to 123        
        And   4 requests are sent to httpbinmock /headers through Lunar Proxy with Authorization header set to 456
        
        And   next epoch-based 1 seconds window arrives

        And   1 request is sent to httpbinmock /headers through Lunar Proxy with Authorization header set to 123        
        And   1 request is sent to httpbinmock /headers through Lunar Proxy with Authorization header set to 456

        Then Responses have 200, 429, 429, 429, 200, 200, 200, 429, 200, 200 status codes in order

    Scenario: Requests which exceed the quota allocation for their group defined where one group is set to 100% by the remedy receive a rate limit error response
        Given API Provider is up
        And   Lunar Proxy is up
        When  policies.yaml file is updated
        And   policies.yaml includes a strategy_based_throttling remedy for GET httpbinmock /headers requests with 4 requests per 1 seconds grouped by Authorization header with quota_allocations of 25% to "123" and 100% to "456"
        And   policies.yaml file is saved
        And   apply_policies command is run without waiting for Fluent to reload
        
        And   next epoch-based 1 seconds window arrives

        And   4 requests are sent to httpbinmock /headers through Lunar Proxy with Authorization header set to 123
        And   5 requests are sent to httpbinmock /headers through Lunar Proxy with Authorization header set to 456
        
        And   next epoch-based 1 seconds window arrives
        
        And   1 request is sent to httpbinmock /headers through Lunar Proxy with Authorization header set to 123
        And   2 requests are sent to httpbinmock /headers through Lunar Proxy with Authorization header set to 456

        Then Responses have 200, 429, 429, 429, 200, 200, 200, 200, 429, 200, 200, 200 status codes in order


    # The following is served as a justification for the results of the following Scenario
    # +----------------+-----+-----+-----+-----+-----+-----+-----+-----+-----+-----+-----+-----+-----+
    # | timeline (sec) | 0   |     |     |     |     |     |     |     |     |     | 2   |     |     |
    # +================+=====+=====+=====+=====+=====+=====+=====+=====+=====+=====+=====+=====+=====+
    # | auth value     | 123 | 123 | 123 | 456 | 456 | 456 | 456 | 456 | 456 | 123 | 123 | 456 | 456 |
    # +----------------+-----+-----+-----+-----+-----+-----+-----+-----+-----+-----+-----+-----+-----+
    # | ungrouped      | V   | V   | V   | V   | X   | X   | X   | X   | X   | X   | V   | V   | V   |
    # +----------------+-----+-----+-----+-----+-----+-----+-----+-----+-----+-----+-----+-----+-----+
    # | grouped        | V   | V   | X   | V   | V   | V   | V   | V   | V   | X   | V   | V   | V   |
    # +----------------+-----+-----+-----+-----+-----+-----+-----+-----+-----+-----+-----+-----+-----+
    # | final          | V   | V   | X   | V   | X   | X   | X   | X   | X   | X   | V   | V   | V   |
    # +----------------+-----+-----+-----+-----+-----+-----+-----+-----+-----+-----+-----+-----+-----+
                       # 200,  200,  429,  200,  429,  429,  429,  429,   429,  429, 200,  200,  200

    Scenario: Requests which exceed the quota allocation with no group and then with group by the remedy receive a rate limit error response
        Given API Provider is up
        And   Lunar Proxy is up
        When  policies.yaml file is updated
        And   policies.yaml includes a strategy_based_throttling remedy for GET httpbinmock /headers requests with 4 requests per 2 seconds
        And   policies.yaml includes a strategy_based_throttling remedy for GET httpbinmock /headers requests with 8 requests per 4 seconds grouped by Authorization header with quota_allocations of 25% to "123" and 100% to "456"
        And   policies.yaml file is saved
        And   apply_policies command is run without waiting for Fluent to reload
        
        And   next epoch-based 4 seconds window arrives
        And   wait 1 seconds
        
        And   3 requests are sent to httpbinmock /headers through Lunar Proxy with Authorization header set to 123
        And   6 requests are sent to httpbinmock /headers through Lunar Proxy with Authorization header set to 456
        And   1 requests are sent to httpbinmock /headers through Lunar Proxy with Authorization header set to 123
        
        And   next epoch-based 4 seconds window arrives
        
        And   1 requests are sent to httpbinmock /headers through Lunar Proxy with Authorization header set to 123
        And   2 requests are sent to httpbinmock /headers through Lunar Proxy with Authorization header set to 456

        Then Responses have 200, 200, 429, 200, 429, 429, 429, 429, 429, 429, 200, 200, 200 status codes in order
