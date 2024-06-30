@secondaryTests
Feature: Lunar managed endpoints
    Background: Starts the Proxy
        Given Lunar Proxy is up

    Scenario: By default, Lunar does not manage all endpoints
        Given API Provider is up
        And Lunar Proxy is down
        And Lunar Proxy is up
        When A request is sent to Lunar Proxy to get if all endpoints are managed
        Then Lunar Proxy returns that all endpoints are not managed

    Scenario Outline: Lunar manages an endpoint
        Given API Provider is up
        When A request is sent to Lunar Proxy to manage an endpoint with an exact URL
        And A request is sent to Lunar Proxy to get if a <is_matching> endpoint is managed
        Then Lunar Proxy returns that the endpoint is <is_managed>

        Examples:
            | is_matching   | is_managed    |
            | matching      | managed       |
            | non-matching  | not managed   |

    Scenario Outline: Lunar manages an endpoint with path parameters
        Given API Provider is up
        When A request is sent to Lunar Proxy to manage an endpoint with path parameters
        And A request is sent to Lunar Proxy to get if a <is_matching> endpoint is managed
        Then Lunar Proxy returns that the endpoint is <is_managed>

        Examples:
            | is_matching   | is_managed    |
            | matching      | managed       |
            | non-matching  | not managed   |

    Scenario Outline: Lunar manages an endpoint with a wildcard
        Given API Provider is up
        When A request is sent to Lunar Proxy to manage an endpoint with a wildcard
        And A request is sent to Lunar Proxy to get if a <is_matching> endpoint is managed
        Then Lunar Proxy returns that the endpoint is <is_managed>

        Examples:
            | is_matching   | is_managed    |
            | matching      | managed       |
            | non-matching  | not managed   |

    Scenario Outline: Lunar manages an endpoint with path parameters and a wildcard
        Given API Provider is up
        When A request is sent to Lunar Proxy to manage an endpoint with path parameters and a wildcard
        And A request is sent to Lunar Proxy to get if a <is_matching> endpoint is managed
        Then Lunar Proxy returns that the endpoint is <is_managed>

        Examples:
            | is_matching   | is_managed    |
            | matching      | managed       |
            | non-matching  | not managed   |

    Scenario Outline: Lunar manages an endpoint with a path parameter in the hostname
        Given API Provider is up
        When A request is sent to Lunar Proxy to manage an endpoint with a path parameter in the hostname
        And A request is sent to Lunar Proxy to get if a <is_matching> endpoint is managed
        Then Lunar Proxy returns that the endpoint is <is_managed>

        Examples:
            | is_matching   | is_managed    |
            | matching      | managed       |
            | non-matching  | not managed   |


    Scenario: Lunar does not manage an unknown endpoint
        Given API Provider is up
        When A request is sent to Lunar Proxy to get if an unknown endpoint is managed
        Then Lunar Proxy returns that the endpoint is not managed

    Scenario: Lunar manages all endpoints
        Given API Provider is up
        When A request is sent to Lunar Proxy to manage all endpoints
        And A request is sent to Lunar Proxy to get if all endpoints are managed
        Then Lunar Proxy returns that all endpoints are managed
