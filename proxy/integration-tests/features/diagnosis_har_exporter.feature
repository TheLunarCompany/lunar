Feature: Lunar Proxy export HAR diagnosis made
    Scenario: Request to a diagnosed endpoint is written
        Given   API Provider is up
        When    policies.yaml file is updated
        And     policies.yaml includes a har_exporter diagnosis for GET httpbinmock /anything/non_obfuscated_har/* requests with obfuscation disabled and without exclusions
        And     policies.yaml includes a s3_minio exporter with bucket_name: lunar-proxy-bucket and url: http://minio:9000
        And     policies.yaml file is saved
        And     apply_policies command is run
        And     A request to httpbinmock /anything/non_obfuscated_har/sensitiveData is made through Lunar Proxy
        Then    Transaction data is written
        And     Entry Status should be 200
        And     Entry Method should be GET
        And     Entry URL should be http://httpbinmock/anything/non_obfuscated_har/sensitiveData
        And     Entry Content-Type header should not be obfuscated
        And     Entry Body `json` field should not be obfuscated

    Scenario: Request to a diagnosed endpoint is written obfuscated
        Given   API Provider is up
        When    policies.yaml file is updated
        And     policies.yaml includes a har_exporter diagnosis for GET httpbinmock /anything/obfuscated_har/* requests with obfuscation enabled and without exclusions
        And     policies.yaml includes a s3_minio exporter with bucket_name: lunar-proxy-bucket and url: http://minio:9000
        And     policies.yaml file is saved
        And     apply_policies command is run
        And     A request to httpbinmock /anything/obfuscated_har/sensitiveData is made through Lunar Proxy
        Then    Transaction data is written
        And     Entry Status should be 200
        And     Entry Method should be GET
        # the ending of the URL is literally the string `sensitiveData` hashed with MD5
        And     Entry URL should be http://httpbinmock/anything/obfuscated_har/df911b273b84d487b8fd7a129cde8351
        And     Entry Content-Type header should be obfuscated
        And     Entry Body `json` field should be obfuscated

    Scenario: Request to a diagnosed endpoint is written obfuscated with exclusions on obfuscation
        Given   API Provider is up
        When    policies.yaml file is updated
        And     policies.yaml includes a har_exporter diagnosis for GET httpbinmock /anything/obfuscated_har_with_exclusions/{id}/placeholder requests with obfuscation enabled and with exclusions
        And     policies.yaml includes a s3_minio exporter with bucket_name: lunar-proxy-bucket and url: http://minio:9000
        And     policies.yaml file is saved
        And     apply_policies command is run
        And     A request to httpbinmock /anything/obfuscated_har_with_exclusions/22/placeholder is made through Lunar Proxy
        Then    Transaction data is written
        And     Entry Status should be 200
        And     Entry Method should be GET
        And     Entry URL should be http://httpbinmock/anything/obfuscated_har_with_exclusions/22/placeholder
        And     Entry Content-Type header should not be obfuscated
        And     Entry Body `json` field should not be obfuscated

    Scenario: Request to an undiagnosed endpoint is not written
        Given   API Provider is up
        When    A request to httpbinmock /anything/not_diagnosed is made through Lunar Proxy
        Then    Transaction data is not written

    Scenario: Transaction to a diagnosed endpoint with a fixed response remedy is written
        Given   API Provider is up
        When    policies.yaml file is updated
        And     policies.yaml includes a har_exporter diagnosis for GET httpbinmock /anything/foo requests with obfuscation disabled and without exclusions
        And     policies.yaml includes a s3_minio exporter with bucket_name: lunar-proxy-bucket and url: http://minio:9000
        And     policies.yaml includes a fixed_response remedy for GET httpbinmock /anything/foo requests with status code 418
        And     policies.yaml file is saved
        And     apply_policies command is run
        And     A request to http:// httpbinmock :80 /anything/foo is made through Lunar Proxy with header 'Early-Response: true'
        Then    Transaction data is written
        And     Entry Status should be 418
        And     Entry Method should be GET
        And     Entry URL should be http://httpbinmock/anything/foo

    Scenario: Request to a diagnosed endpoint which returns gzipped body is written
        Given   API Provider is up
        When    policies.yaml file is updated
        And     policies.yaml includes a har_exporter diagnosis for GET httpbinmock /gzip requests with obfuscation enabled and without exclusions
        And     policies.yaml includes a s3_minio exporter with bucket_name: lunar-proxy-bucket and url: http://minio:9000
        And     policies.yaml file is saved
        And     apply_policies command is run
        And     A request to httpbinmock /gzip is made through Lunar Proxy
        Then    Transaction data is written
        And     Entry Status should be 200
        And     Entry Method should be GET
        And     Entry URL should be http://httpbinmock/gzip
        And     Entry Content-Type header should be obfuscated
        And     Entry Body field compressed with `gzipped` should be obfuscated
