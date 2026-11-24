# This is since `behave` is really mistyped and all dynamic.
# Might be handled later.
# type: ignore
from aiohttp import ClientSession
from typing import Any

from utils.docker import (
    build_service,
    start_service,
    down_services,
    stop_service,
    rm_service,
)
from utils.consts import *

from behave.model import Scenario
from behave.api.async_step import async_run_until_complete

from toolkit_testing.integration_tests.mox import MoxHelper
from toolkit_testing.integration_tests.s3 import S3ClientHelper, AWSAccess
from toolkit_testing.integration_tests.routing import Routing

_mox_helper = MoxHelper(host="http://localhost", port=8888)

_minio_client_helper = S3ClientHelper(
    AWSAccess(AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY),
    Routing("127.0.0.1", 9000),
)


@async_run_until_complete
async def before_all(_: Any):
    try:
        await down_services()
    except Exception as exc:
        print(exc)

    await start_service(MINIO_SERVICE_NAME, [])
    assert _minio_client_helper.healthcheck(retries=HEALTHCHECK_RETRIES, sleep_s=1)
    _minio_client_helper.create_bucket(LUNAR_BUCKET_NAME)
    _minio_client_helper.create_bucket(LUNAR_OTHER_BUCKET_NAME)


@async_run_until_complete
async def after_all(_: Any):
    print("shutting down services")
    await down_services()


@async_run_until_complete
async def before_scenario(context: Any, _: Scenario):
    # TODO: move all lunar related object into a single object within context
    #       this will help us clean easily without having to remember all the objects.
    context.lunar_proxy_env_vars = []
    context.local_responses = {}
    context.created_mox_endpoint_ids = []
    context.marked_objects = {}


@async_run_until_complete
async def after_scenario(context: Any, _: Scenario):
    try:
        _minio_client_helper.clean_bucket(LUNAR_BUCKET_NAME)
        _minio_client_helper.clean_bucket(LUNAR_OTHER_BUCKET_NAME)
    except Exception as exc:
        print("failed cleaning S3 bucket")
        print(exc)

    # delete any mox endpoint that was created during the test
    for endpoint_id in context.created_mox_endpoint_ids:
        await _mox_helper.delete_mox_proxy_path(endpoint_id)


async def _up_service(service_name: str):
    await build_service(service_name, [], [])
    await start_service(service_name, [])


async def _down_service(service_name: str):
    await stop_service(service_name)
    await rm_service(service_name)


async def reload_policies():
    url = f"http://localhost:{ENGINE_ADMIN_PORT}{RELOAD_POLICIES_PATH}"
    async with ClientSession() as session:
        try:
            async with session.post(url=url) as resp:
                status = resp.status
                await resp.text()
                assert status == 200
                return
        except Exception as ex:
            print(f"failed reloading policies: {ex}")
            return
