@legacy
Feature: Lunar Proxy MetricsCollector Diagnosis
    Background: Starts the Proxy
        Given   API Provider is up
        # The next 2 steps are madnatory in order to clean OTEL state.
        # TODO use future `reset` functionality instead and save some time 💪

        
    Scenario: Request to a diagnosed endpoint is written
        Given   Lunar Proxy is down
        And     Lunar Proxy is up
        When    policies.yaml file is updated
        And     policies.yaml includes a metrics_collector diagnosis for GET httpbinmock /anything/* requests with s3_minio as exporter
        And     policies.yaml includes a s3_minio exporter with bucket_name: lunar-proxy-bucket and url: http://minio:9000
        And     policies.yaml file is saved
        And     apply_policies command is run
        And     A request to httpbinmock /anything/ciao is made through Lunar Proxy
        Then    Transaction metrics are written
        And     Traffic Metrics status should be 200
        And     Traffic Metrics method should be GET
        And     Traffic Metrics normalized_url should be httpbinmock/anything/*

    Scenario: Request is written when global diagnosis is applied
        Given   Lunar Proxy is down
        And     Lunar Proxy is up
        When    policies.yaml file is updated
        And     policies.yaml includes a global metrics_collector diagnosis with s3_minio as exporter
        And     policies.yaml includes a s3_minio exporter with bucket_name: lunar-proxy-bucket and url: http://minio:9000
        And     policies.yaml file is saved
        And     apply_policies command is run
        And     A request to httpbinmock /anything/ciao is made through Lunar Proxy
        Then    Transaction metrics are written
        And     Traffic Metrics status should be 200
        And     Traffic Metrics method should be GET
        And     Traffic Metrics normalized_url should be httpbinmock
    
    Scenario: Request is exported to Prometheus metric server
        Given   Lunar Proxy is down
        And     Lunar Proxy is up
        When    policies.yaml file is updated
        And     policies.yaml includes a global metrics_collector diagnosis with prometheus as exporter
        And     policies.yaml file is saved
        And     apply_policies command is run
        And     A request to httpbinmock /status/200 is made through Lunar Proxy
        And     A request to httpbinmock /status/200 is made through Lunar Proxy
        And     A request to httpbinmock /status/500 is made through Lunar Proxy
        Then    There are 2 lunar_transaction histograms on Prometheus Metric Server
        And     There is a histogram of status 200, normalized_url httpbinmock with 2 calls
        And     There is a histogram of status 500, normalized_url httpbinmock with 1 calls

    Scenario: User-defined counters are exported to Prometheus metric server
        Given   Lunar Proxy is down
        And     Lunar Proxy is up
        When    policies.yaml file is updated
        And     policies.yaml includes a global metrics_collector diagnosis with prometheus as exporter and custom counter for My-Header response header
        And     policies.yaml file is saved
        And     apply_policies command is run
        And     A request to httpbinmock /response-headers?My-Header=1 is made through Lunar Proxy
        And     A request to httpbinmock /response-headers?My-Header=3 is made through Lunar Proxy
        And     A request to httpbinmock /response-headers?My-Header=non_numeric is made through Lunar Proxy
        And     A request to httpbinmock /response-headers?My-Header=2 is made through Lunar Proxy
        Then    There are 1 lunar_transaction histograms on Prometheus Metric Server
        And     There is a histogram of status 200, normalized_url httpbinmock with 4 calls
        And     There is a counter named lunar_response_headers_My_Header_total with the value 6
