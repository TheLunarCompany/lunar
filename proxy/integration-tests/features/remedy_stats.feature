Feature: Lunar Proxy - Remedy Stats
    Background: Starts the Proxy
        # The next 2 steps are mandatory in order to clean Remedy Stats state.
        # TODO use future `reset` functionality instead and save some time 💪
        Given   Lunar Proxy is down
        And     Lunar Proxy is up
        
    Scenario: Remedy Stats metrics are written
        Given   API Provider is up
        
        When    policies.yaml file is updated
        And     policies.yaml includes a fixed_response remedy for GET mox /status/* requests with status code 400
        And     policies.yaml file is saved
        And     apply_policies command is run
        
        And     mox is set to return status code 400 on GET /status
        And     A request to http:// mox :8888 /status is made through Lunar Proxy with header 'Early-Response: false'
        And     mox is set to return status code 200 on GET /status
        And     A request to http:// mox :8888 /status is made through Lunar Proxy with header 'Early-Response: true'
        And     A request to http:// mox :8888 /status is made through Lunar Proxy with header 'Early-Response: false'
        And     A request to http:// mox :8888 /status is made through Lunar Proxy with header 'Early-Response: true'

        Then    Remedy stats metrics (marked as top_level) gets the 2 generated responses out of a total of 4 transactions
        And     item top_level has field remedy_stats (marked remedy_stats)
        And     item remedy_stats is an array with item that matches {"remedy": "fixed_response", "action": "generated"} (marked as remedy_stat)
        And     item remedy_stat affected_ratio is 0.5
        And     item remedy_stat affected_count is 2

        And     item remedy_stat has field affected_stats_by_endpoint (marked endpoint_stats)
        And     item endpoint_stats is an array with item that matches {"method": "GET", "url": "mox/status"} (marked as endpoint_stat)
        And     item endpoint_stat count is 2
        And     item endpoint_stat count_by_status_code json is {"400": 2}

        And     item top_level has field remedy_action_stats (marked remedy_action_stats)
        And     item remedy_action_stats has field generated (marked action_generated_stats)
        And     item action_generated_stats count is 2
        And     item action_generated_stats ratio is 0.5
        And     item action_generated_stats ratio_by_status_code json is {"400": 0.5}
