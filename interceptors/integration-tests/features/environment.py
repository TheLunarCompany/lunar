# type: ignore
# This is since `behave` is really mistyped and all dynamic.
# Might be handled later.
import os

from behave.api.async_step import async_run_until_complete
from typing import Any

from toolkit_testing.integration_tests.docker import EnvVar
from toolkit_testing.integration_tests.mox import MoxHelper
from utils.logic_mock_helper import LogicMockHelper
from utils.docker import stop_service, start_service
from utils.httpbin import HTTPBinHelper

_ENV_PY_VER_KEY = "PYTHON_VERSION"
_ENV_LIB_VER_KEY = "AIOHTTP_VERSION"
_ENV_INTERCEPTOR_DIR = "INTERCEPTOR_DIR"
_JAVA_INTERCEPTOR_DIR = "../lunar-java-interceptor"
_PYTHON_INTERCEPTOR_DIR = "../lunar-py-interceptor"
_AIOHTTP_LIB_VERSION = "3.8.3"

CLIENT_SERVICE_NAME = "client"
MOX_SERVICE_NAME = "mox"
LOGIC_MOCK_SERVER_SERVICE_NAME = "logic-mock-server"
HTTPBIN_SERVICE_NAME = "httpbinmock"

mox_helper = MoxHelper(host="http://localhost", port=9898)
logic_mock_helper = LogicMockHelper(host="http://localhost", port=9000)
_httpbin_helper = HTTPBinHelper(host="http://localhost", port=80)


@async_run_until_complete
async def before_scenario(context: Any, _):
    _ensure_client_env_vars(context)
    try:
        await mox_helper.delete_all_mox_proxy_paths()
    except:
        pass


@async_run_until_complete
async def before_all(context: Any):
    _ensure_client_env_vars(context)
    await start_service(HTTPBIN_SERVICE_NAME, context.env_values)
    assert await _httpbin_helper.healthcheck(retries=10, sleep_s=1)


@async_run_until_complete
async def after_all(context: Any):
    await stop_service(MOX_SERVICE_NAME, context.env_values)
    await stop_service(CLIENT_SERVICE_NAME, context.env_values)
    await stop_service(LOGIC_MOCK_SERVER_SERVICE_NAME, context.env_values)
    await stop_service(HTTPBIN_SERVICE_NAME, context.env_values)


def _ensure_client_env_vars(context):
    context.env_values = []
    context.build_args = []
    client_language = os.environ.get("CLIENT_LANGUAGE")
    client_version = os.environ.get("CLIENT_VERSION")

    if client_language == "python":
        _ensure_env_var(
            context.env_values, _ENV_INTERCEPTOR_DIR, _PYTHON_INTERCEPTOR_DIR
        )
        _ensure_env_var(context.build_args, _ENV_PY_VER_KEY, client_version)
        _ensure_env_var(context.build_args, _ENV_LIB_VER_KEY, _AIOHTTP_LIB_VERSION)
    elif client_language == "java":
        _ensure_env_var(context.env_values, _ENV_INTERCEPTOR_DIR, _JAVA_INTERCEPTOR_DIR)
    else:
        raise Exception("Unsupported language")


def _ensure_env_var(key_value_pairs: list[EnvVar], key: str, value: str):
    for key_value in key_value_pairs:
        if key_value.name == key:
            key_value.value = value
            return

    key_value_pairs.append(EnvVar(key, value))
