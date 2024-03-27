# type: ignore
# This is since `behave` is really mistyped and all dynamic.
# Might be handled later.
from typing import Any
from behave import given, when

from toolkit_testing.integration_tests.docker import EnvVar


@given(
    "client application is configured with LUNAR_ENTER_COOLDOWN_AFTER_ATTEMPTS={failed_attempts:Int}"
)
def step_impl(context: Any, failed_attempts: int):
    context.max_failed_attempts = failed_attempts
    context.env_values.append(
        EnvVar("LUNAR_ENTER_COOLDOWN_AFTER_ATTEMPTS", str(failed_attempts))
    )


@given(
    "client application is configured with LUNAR_EXIT_COOLDOWN_AFTER_SEC={exit_after:Int}"
)
def step_impl(context: Any, exit_after: int):
    context.exit_cooldown_after = exit_after
    context.env_values.append(EnvVar("LUNAR_EXIT_COOLDOWN_AFTER_SEC", str(exit_after)))


@given("Interceptor enter into FailSafe mode")
def step_impl(context: Any):
    context.execute_steps("Given Lunar Proxy is down")

    for _ in range(context.max_failed_attempts):
        context.execute_steps("When client application makes an outgoing HTTP call")
        context.execute_steps("Then response will return from original provider")


@given("Interceptor enter into FailSafe mode after error from Lunar Proxy")
def step_impl(context: Any):
    for _ in range(context.max_failed_attempts):
        context.execute_steps(
            "When client application makes an outgoing HTTP call to bad URL"
        )


@when("LUNAR_EXIT_COOLDOWN_AFTER_SEC passes, the Interceptor exits the FailSafe mode")
def step_impl(context: Any):
    context.execute_steps("Given Lunar Proxy is up")
    context.execute_steps("Given Mox path valid endpoint is set")

    context.execute_steps(
        "When {time_to_wait} seconds pass".format(
            time_to_wait=context.exit_cooldown_after
        )
    )
