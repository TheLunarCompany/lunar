@gateway
Feature: Healthcheck
    Scenario: proxy_only healthcheck is requested
        Given   Lunar Proxy is up
        When    A local GET request (id healthcheck) is made to port 8040 at path /healthcheck
        Then    Response (id healthcheck) status code should be 200

    Scenario: healthcheck is requested at wrong path
        Given   Lunar Proxy is up
        When    A local GET request (id healthcheck) is made to port 8040 at path /wrong_path
        Then    Response (id healthcheck) status code should be 404
