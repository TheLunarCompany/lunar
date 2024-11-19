@legacy
Feature: Policies Reload
    Scenario: Valid policies reload
        Given   Lunar Proxy is up
        And     API Provider is up
        When    policies.yaml file is updated
        And     policies.yaml includes a fixed_response remedy for GET mox /json requests with status code 202
        And     policies.yaml file is saved
        And     apply_policies command is run without waiting for Fluent to reload
        And     A request to http:// mox :8888 /json is made through Lunar Proxy with header 'Early-Response: true'
        Then    Response has status 202

    # TODO: Check why there is a need to stop the Gateway
    Scenario: Invalid policies reload
        Given   Lunar Proxy is down
        And     API Provider is up
        And     Lunar Proxy is up
        And     mox is set to respond to GET /json with status 201
        When    policies.yaml file is updated
        And     policies.yaml includes a fixed_response remedy for GET mox /json requests with invalid config
        And     policies.yaml file is saved
        And     A local POST request (id apply_policies) is made to port 8081 at path /apply_policies
        And     A request to http:// mox :8888 /json is made through Lunar Proxy with header 'Early-Response: true'
        Then    Response (id apply_policies) status code should be 422
        Then    Response has status 201

    Scenario: Exporters reload
        Given   Lunar Proxy is up
        And     API Provider is up
        When    policies.yaml file is updated
        And     policies.yaml includes a har_exporter diagnosis for GET httpbinmock /* requests with obfuscation disabled and without exclusions
        And     policies.yaml includes a s3_minio exporter with bucket_name: lunar-proxy-other-bucket and url: http://minio:9000
        And     policies.yaml file is saved
        And     apply_policies command is run
        And     A request to httpbinmock /anything/1 is made through Lunar Proxy
        Then    Transaction data is written to bucket lunar-proxy-other-bucket
