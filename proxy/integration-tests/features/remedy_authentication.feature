@legacy
Feature: Lunar Proxy authentication remedy
    Background: Starts the Proxy
        Given   Lunar Proxy is up
        And     API Provider is up
        When    policies.yaml file is updated
        And     policies.yaml includes accounts section with all auth accounts

    Scenario: Basic Authentication
        When    policies.yaml includes a enabled authentication of type basic for GET httpbinmock /headers requests
        And     policies.yaml file is saved
        And     apply_policies command is run without waiting for Fluent to reload
        And     Request to http:// httpbinmock :80 /headers is made through Lunar Proxy
        Then    Request was sent with "Authorization" header with value "Basic QmFzaWNOYW1lOkJhc2ljVmFsdWU="

    Scenario: ApiAuth Authentication
        When    policies.yaml includes a enabled authentication of type api_key for GET httpbinmock /headers requests
        And     policies.yaml file is saved
        And     apply_policies command is run without waiting for Fluent to reload
        And     Request to http:// httpbinmock :80 /headers is made through Lunar Proxy
        Then    Request was sent with "Apikeyname" header with value "APIKeyValue"

    Scenario: OAuth Authentication
        When    policies.yaml includes a enabled authentication of type o_auth for POST httpbinmock /post requests
        And     policies.yaml file is saved
        And     apply_policies command is run without waiting for Fluent to reload
        And     Request to POST http:// httpbinmock :80 /post is made through Lunar Proxy
        Then    Request was sent with "OAuthName" body key with value "OAuthValue"
        And     Request headers are not modified
