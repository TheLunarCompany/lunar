# type: ignore

import json
from datetime import datetime, timedelta
from enum import Enum
import json
from typing import Any, Optional
from dataclasses import dataclass
from typing import Any

from behave import then, when, register_type
from behave.api.async_step import async_run_until_complete

from utils.consts import *
from utils.policies import EndpointPolicy, PoliciesRequests

from toolkit_testing.integration_tests.s3 import S3ClientHelper, AWSAccess
from toolkit_testing.integration_tests.routing import Routing
from utils.client import make_request

_DATE_FORMAT = "%Y-%m-%dT%H:%M:%S.%fZ"

_minio_client_helper = S3ClientHelper(
    AWSAccess(AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY),
    Routing("127.0.0.1", 9000),
)

_HTTPBIN_ANYTHING_JSON_FIELD = "json"


def parse_with_obfuscation_enabled(text: str) -> bool:
    if text == "with obfuscation enabled":
        return True
    if text == "with obfuscation disabled":
        return False
    raise Exception(f"{text} is not recognized")


def parse_with_exclusions(text: str) -> bool:
    if text == "with exclusions":
        return True
    if text == "without exclusions":
        return False
    raise Exception(f"{text} is not recognized")


def parse_obfuscated(text: str) -> bool:
    if text == "obfuscated":
        return True
    if text == "not obfuscated":
        return False
    raise Exception(f"{text} is not recognized")


def parse_status_code(text: str) -> int:
    return int(text)


register_type(WithObfuscation=parse_with_obfuscation_enabled)
register_type(WithExclusions=parse_with_exclusions)
register_type(Obfuscated=parse_obfuscated)
register_type(StatusCode=parse_status_code)


@dataclass
class ExpectedValues:
    method: str
    url: str
    status_code: int
    # Inspecting headers and body values is only needed in obfuscation tests
    content_type_header: Optional[str] = None
    response_body_field_name: Optional[str] = None
    response_body_field_value: Optional[str] = None


class _ObfuscationMode(Enum):
    Disabled = "disabled"
    Enabled = "enabled"
    EnabledWithExclusions = "enabled with exclusions"


@when(
    "Request to an endpoint which is configured with an HAR export diagnosis policy with obfuscation {obfuscation_mode}"
)
@async_run_until_complete
async def step_impl(context: Any, obfuscation_mode: _ObfuscationMode):
    host = "httpbinmock"
    if obfuscation_mode == _ObfuscationMode.Enabled.value:
        path = "/anything/obfuscated_har/sensitiveData"
    elif obfuscation_mode == _ObfuscationMode.Disabled.value:
        path = "/anything/non_obfuscated_har/sensitiveData"
    elif obfuscation_mode == _ObfuscationMode.EnabledWithExclusions.value:
        path = "/anything/obfuscated_har_with_exclusions/22/placeholder"

    context.request_time = datetime.utcnow()
    response = await make_request(host, path, is_proxified=True)
    context.response = response


@when(
    "Request to an endpoint which is not configured with an HAR export diagnosis policy"
)
@async_run_until_complete
async def step_impl(context: Any):
    host = "httpbinmock"
    path = "/anything/undiagnosed"
    expected_har_url = f"http://httpbinmock/anything/undiagnosed"
    context.expected_values = ExpectedValues(
        method="GET",
        url=expected_har_url,
        status_code=200,
    )
    context.request_time = datetime.utcnow()
    response = await make_request(host, path, is_proxified=True)
    context.response = response


@when(
    "Request to an endpoint which is configured with a fixed response remedy and an HAR export diagnosis policy"
)
@async_run_until_complete
async def step_impl(context: Any):
    host = "httpbinmock"
    path = "/anything/remediated_and_diagnosed"
    expected_har_url = "http://httpbinmock/anything/remediated_and_diagnosed"
    context.expected_values = ExpectedValues(
        method="GET",
        url=expected_har_url,
        status_code=418,
    )
    context.request_time = datetime.utcnow()
    response = await make_request(
        host,
        path,
        is_proxified=True,
        header_key="Early-Response",
        header_value="true",
    )
    context.response = response


@when(
    "policies.yaml includes a har_exporter diagnosis for {method} {host} {path:Path} requests {with_obfuscation:WithObfuscation} and {with_exclusions:WithExclusions}"
)
def step_impl(
    context: Any,
    method: str,
    host: str,
    path: str,
    with_obfuscation: bool,
    with_exclusions: bool,
):
    policies_requests: PoliciesRequests = context.policies_requests
    diagnosis = {
        "name": "har_exporter for {method} {host}/{path}",
        "enabled": True,
        "export": "s3_minio",
        "config": {
            "har_exporter": {
                "transaction_max_size": 25000,
                "export_to_folder": "/har_files",
                "obfuscate": {"enabled": with_obfuscation},
            }
        },
    }
    if with_exclusions:
        diagnosis["config"]["har_exporter"]["obfuscate"]["exclusions"] = {
            "path_params": ["id"],
            "response_headers": ["Content-Type"],
            "response_body_paths": [".json"],
        }
    policies_requests.endpoints.append(
        EndpointPolicy(method, f"{host}{path}", diagnosis=[diagnosis])
    )


@when(
    "policies.yaml includes a {exporter_type} exporter with {key1}: {value1} and {key2}: {value2}"
)
@async_run_until_complete
async def step_impl(
    context: Any, exporter_type: str, key1: str, value1: str, key2: str, value2: str
):
    policies_requests: PoliciesRequests = context.policies_requests
    for exporter, config in policies_requests.exporters.items():
        print(f"Exporter: {exporter}")
        print(f"Config: {config}")
        if exporter == exporter_type:
            print(
                f"Updating exporter {exporter_type} with {key1}: {value1} and {key2}: {value2}"
            )
            config[key1] = value1
            config[key2] = value2
            return

    print(f"Adding exporter {exporter_type} with {key1}: {value1} and {key2}: {value2}")
    policies_requests.exporters[exporter_type] = {key1: value1, key2: value2}


@then("Transaction data is written")
@async_run_until_complete
async def step_impl(context: Any):
    now = datetime.utcnow()
    content = _minio_client_helper.get_object_content_of_last_modified_object(
        LUNAR_BUCKET_NAME, retries=20
    )
    har, start_time = _read_last_har(content)

    assert content is not None
    assert len(har) > 0

    assert start_time < now + timedelta(seconds=10)
    assert start_time > now - timedelta(seconds=10)
    request = har["log"]["entries"][0]["request"]
    response = har["log"]["entries"][0]["response"]

    assert request is not None
    assert response is not None

    context.request = request
    context.response = response


@then("Transaction data is written to bucket {expected_bucket_name}")
@async_run_until_complete
async def step_impl(context: Any, expected_bucket_name: str):
    now = datetime.utcnow()
    content = _minio_client_helper.get_object_content_of_last_modified_object(
        expected_bucket_name, retries=20
    )
    har, start_time = _read_last_har(content)

    assert content is not None
    assert len(har) > 0

    assert start_time < now + timedelta(seconds=10)
    assert start_time > now - timedelta(seconds=10)
    request = har["log"]["entries"][0]["request"]
    response = har["log"]["entries"][0]["response"]

    assert request is not None
    assert response is not None

    context.request = request
    context.response = response


@then("Entry Status should be {status_code:StatusCode}")
@async_run_until_complete
async def step_impl(context: Any, status_code: int):
    assert context.response["status"] == status_code


@then("Entry Method should be {method}")
@async_run_until_complete
async def step_impl(context: Any, method: str):
    assert context.request["method"] == method


@then("Entry URL should be {url}")
@async_run_until_complete
async def step_impl(context: Any, url: str):
    assert context.request["url"] == url


@then("Entry URL should start with {partial_url}")
@async_run_until_complete
async def step_impl(context: Any, partial_url: str):
    assert context.request["url"].startswith(partial_url)


@then("Entry URL should end with {partial_url}")
@async_run_until_complete
async def step_impl(context: Any, partial_url: str):
    assert context.request["url"].endswith(partial_url)


@then("Entry Body `json` field should be obfuscated")
@async_run_until_complete
async def step_impl(context: Any):
    response_body = json.loads(context.response["content"])
    # literally, the string `null` (JSON's null) hashed with MD5:
    json_null_md5 = "37a6259cc0c1dae299a7866489dff0bd"
    assert response_body[_HTTPBIN_ANYTHING_JSON_FIELD] == json_null_md5


@then("Entry Body `json` field should not be obfuscated")
@async_run_until_complete
async def step_impl(context: Any):
    response_body = json.loads(context.response["content"])
    # The field is `null`, so Python's `None` actually means it was not obfuscated
    assert response_body[_HTTPBIN_ANYTHING_JSON_FIELD] == None


@then("Entry Body field compressed with `{compression}` should be obfuscated")
@async_run_until_complete
async def step_impl(context: Any, compression: str):
    response_body = json.loads(context.response["content"])
    # originally JSON's `true`, here in md5 https://md5.gromweb.com/?string=true
    assert response_body[compression] == "b326b5062b2f0e69046810717534cb09"


@then("Entry Content-Type header should be obfuscated")
@async_run_until_complete
async def step_impl(context: Any):
    har_content_type = get_header(context.response["headers"], "Content-Type")
    assert har_content_type == "d1f5a9d446c6cec2cf63545e8163e585"


@then("Entry Content-Type header should not be obfuscated")
@async_run_until_complete
async def step_impl(context: Any):
    har_content_type = get_header(context.response["headers"], "Content-Type")
    assert har_content_type == "application/json"


def get_header(headers: dict[str, str], header_name: str) -> Optional[str]:
    return [header["value"] for header in headers if header["name"] == header_name][0]


@then("Transaction data is not written")
@async_run_until_complete
async def step_impl(context: Any):
    content = _minio_client_helper.get_object_content_of_last_modified_object(
        LUNAR_BUCKET_NAME, retries=20
    )
    har, start_time = _read_last_har(content)

    assert (
        content is None  # No file
        or len(har) == 0  # Empty file
        or start_time < context.request_time  # Old HAR data
    )


def _read_last_har(content: str | None) -> tuple[dict[str, Any], datetime]:
    if content is None:
        return {}, datetime.utcnow()
    har_data = content.splitlines()
    assert len(har_data) > 0
    raw_har = har_data[-1]
    har = json.loads(raw_har)

    start_time = _parse_start_time(har)
    return har, start_time


def _parse_start_time(har: dict[str, Any]):
    start_time_str = har["log"]["entries"][0]["startedDateTime"][:-4] + "Z"
    return datetime.strptime(start_time_str, _DATE_FORMAT)
