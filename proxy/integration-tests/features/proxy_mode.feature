Feature: Lunar Proxy - proxy made
    Scenario: Request passes through Lunar Proxy
        Given   API Provider is up
        And     Lunar Proxy is up
        When    Request to http:// mox :8888 /uuid is made through Lunar Proxy
        And     Request to http:// mox :8888 /uuid is made directly to API Provider
        Then    Responses have the same body and status

    Scenario: Request passes through Lunar Proxy and an error is generated from Lunar Proxy
        Given   API Provider is up
        And     Lunar Proxy is up
        When    Request to http:// bad-host :80 /bad_path is made through Lunar Proxy
        Then    Response have the error indicator header
        And     Response error message should be `Could not resolve host`

    Scenario: Request passes through Lunar Proxy and an error is generated from Provider
        Given   API Provider is up
        And     Lunar Proxy is up
        When    Request to http:// httpbinmock :80 /status/503 is made through Lunar Proxy
        Then    Response dont have the error indicator header

    Scenario: Request passes through Lunar Proxy and timeout is reached
        Given   API Provider is up
        And     Lunar Proxy env var `LUNAR_SERVER_TIMEOUT_SEC` set to `1`
        And     Lunar Proxy is up
        When    Request to http:// httpbinmock :80 /delay/10 is made through Lunar Proxy
        Then    Response have the error indicator header
        And     Response error message should be `Gateway timeout`

    Scenario: Request passes through Lunar Proxy, response is chunked
        Given   API Provider is up
        And     Lunar Proxy is up
        When    Request to http:// httpbinmock :80 /drip is made through Lunar Proxy
        And     Request to http:// httpbinmock :80 /drip is made directly to API Provider
        Then    Responses have the same body and status

    Scenario: HTTP Request passes through Lunar Proxy without port in Host header
        Given   API Provider is up
        And     Lunar Proxy is up
        When    Request to http:// httpbinmock /status/202 is made through Lunar Proxy
        When    Request to http:// httpbinmock :80 /status/202 is made directly to API Provider
        Then    Responses have the same body and status

    Scenario: API Provider is down
        Given   API Provider is down
        When    Request to http:// mox :8888 /uuid is made through Lunar Proxy
        Then    Response has status 503
        And     Response error message should be `Could not resolve host`

    Scenario: Request passes through prepared Lunar Proxy with query params based redirection
        Given   API Provider is up
        And     Lunar Proxy env var `LUNAR_REDIRECTION_BY_QUERY_PARAMS` set to `1`
        And     Lunar Proxy is up
        When    A request to http:// mox :8888 /uuid is made through Lunar Proxy with query param based redirection
        And     Request to http:// mox :8888 /uuid is made directly to API Provider
        Then    Responses have the same body and status

    Scenario: Request fails to pass through prepared Lunar Proxy with query params based redirection
        Given   API Provider is up
        And     Lunar Proxy env var `LUNAR_REDIRECTION_BY_QUERY_PARAMS` set to `1`
        And     Lunar Proxy is up
        When    Request to http:// mox :8888 /uuid is made through Lunar Proxy without query param based redirection
        Then    Response has status 503
        And     Response error message should be `Could not resolve host`

    Scenario: Request passes through prepared Lunar Proxy to httpbinmock with correct Host header
        Given   API Provider is up
        And     Lunar Proxy env var `LUNAR_REDIRECTION_BY_QUERY_PARAMS` set to `1`
        And     Lunar Proxy is up
        When    A request to http:// httpbinmock :80 /anything is made through Lunar Proxy with query param based redirection
        Then    Proxified response body's `headers.Host` is httpbinmock:80

    Scenario: Lunar Proxy sets x-lunar-sequence-id header on response
        Given   API Provider is up
        And     Lunar Proxy is up
        When    Request to http:// mox :8888 /uuid is made through Lunar Proxy
        Then    Response has x-lunar-sequence-id header

    Scenario: Lunar Proxy sets x-lunar-sequence-id header according to x-lunar-sequence-id header on request
        Given   API Provider is up
        And     Lunar Proxy is up
        When    A request to http:// mox :8888 /uuid is made through Lunar Proxy with header 'x-lunar-sequence-id: 123'
        Then    Response has x-lunar-sequence-id header with value 123

    Scenario: Lunar Proxy removes x-lunar-scheme header if it is in the request
        Given   API Provider is up
        And     Lunar Proxy is up
        When    A request to http:// httpbinmock :80 /anything is made through Lunar Proxy
        Then    Proxified response body has no key `headers.x-lunar-scheme`
