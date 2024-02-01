# type: ignore
# This is since `behave` is really mistyped and all dynamic.
# Might be handled later.

import os
import asyncio
from behave import when
from behave.api.async_step import async_run_until_complete
from typing import Any

import yaml
from utils.consts import *
from utils.policies import (
    PoliciesRequests,
    read_actual_policies_file,
    write_actual_policies_file,
)

from toolkit_testing.integration_tests.fluent_helper import FluentHelper

_FLUENT_HEALTH_HOST = "localhost"
_FLUENT_HEALTH_PORT = 2020
_FLUENT_HEALTHCHECK_RETRIES = 30

_fluent_helper = FluentHelper(_FLUENT_HEALTH_HOST, _FLUENT_HEALTH_PORT)


@when("policies.yaml file is updated")
@async_run_until_complete
async def step_impl(context: Any):
    context.policies_requests = PoliciesRequests()


@when("policies.yaml file is saved")
@async_run_until_complete
async def step_impl(context: Any):
    policies_yaml = context.policies_requests.build_yaml()
    print(f"policies yaml:\n{yaml.dump(policies_yaml)}")
    await write_actual_policies_file(policies_yaml=policies_yaml)


@when("apply_policies command is run")
@async_run_until_complete
async def step_impl(_: Any):
    assert os.system("docker exec lunar-proxy apply_policies") == 0
    await _fluent_helper.healthcheck(retries=_FLUENT_HEALTHCHECK_RETRIES, sleep_s=0.1)


@when("apply_policies command is run without waiting for Fluent to reload")
@async_run_until_complete
async def step_impl(_: Any):
    assert os.system("docker exec lunar-proxy apply_policies") == 0


@when("policies.yaml file is saved on {container_name}")
@async_run_until_complete
async def step_impl(context: Any, container_name: str):
    policies_yaml = context.policies_requests.build_yaml()
    print(f"policies yaml:\n{yaml.dump(policies_yaml)}")
    await write_actual_policies_file(
        policies_yaml=policies_yaml, container_name=container_name
    )


@when(
    "apply_policies command is run on {container_name} without waiting for Fluent to reload"
)
def step_impl(_: Any, container_name: str):
    assert os.system(f"docker exec {container_name} apply_policies") == 0
