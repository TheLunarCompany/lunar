# type: ignore
# This is since `behave` is really mistyped and all dynamic.
# Might be handled later.

import os
from behave import when
from behave.api.async_step import async_run_until_complete
from typing import Any

import yaml
from utils.consts import *
from utils.flows import (
    write_flow_file,
)


@when("flow file is saved")
@async_run_until_complete
async def step_impl(context: Any):
    flow_yaml = context.flow.build_yaml()
    print(f"flow yaml:\n{flow_yaml}")
    await write_flow_file(flow_filename="flow.yaml", flow_yaml=flow_yaml)


@when("flow file is saved with name {file_name}")
@async_run_until_complete
async def step_impl(context: Any, file_name: str):
    flow_yaml = context.flow.build_yaml()
    print(f"flow yaml:\n{flow_yaml}")
    await write_flow_file(flow_filename=file_name, flow_yaml=flow_yaml)


@when("flow file is saved on {container_name}")
@async_run_until_complete
async def step_impl(context: Any, container_name: str):
    flow_yaml = context.flow.build_yaml()
    print(f"flow yaml:\n{flow_yaml}")
    await write_flow_file(
        flow_filename="flow.yaml", flow_yaml=flow_yaml, container_name=container_name
    )


@when("load_flows command is run")
@async_run_until_complete
async def step_impl(_: Any):
    assert os.system("docker exec lunar-proxy load_flows") == 0
