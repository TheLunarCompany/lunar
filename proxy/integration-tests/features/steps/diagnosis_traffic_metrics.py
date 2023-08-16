# type: ignore
import json
from datetime import datetime
from typing import Any
from aiohttp import ClientSession
from prometheus_client.parser import text_string_to_metric_families
from prometheus_client import Metric
from behave import then, when
from behave.api.async_step import async_run_until_complete
from toolkit_testing.integration_tests.routing import Routing
from toolkit_testing.integration_tests.s3 import AWSAccess, S3ClientHelper
from utils.consts import *
from utils.policies import EndpointPolicy, PoliciesRequests

_minio_client_helper = S3ClientHelper(
    AWSAccess(AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY),
    Routing("127.0.0.1", 9000),
)

_LUNAR_TRANSACTION_HISTOGRAM_METRIC_NAME = "lunar_transaction"
_HISTOGRAM_COUNT_SUFFIX = "_count"
_COUNTER_SUFFIX = "_total"


@when(
    "policies.yaml includes a metrics_collector diagnosis for {method} {host} {path:Path} requests with {exporter} as exporter"
)
def step_impl(context: Any, method: str, host: str, path: str, exporter: str):
    policies_requests: PoliciesRequests = context.policies_requests
    diagnosis = {
        "name": "metrics_collector for {method} {host}/{path}",
        "enabled": True,
        "export": exporter,
        "config": {"metrics_collector": {}},
    }
    policies_requests.endpoints.append(
        EndpointPolicy(method, f"{host}{path}", diagnosis=[diagnosis])
    )


@when(
    "policies.yaml includes a global metrics_collector diagnosis with {exporter} as exporter"
)
def step_impl(context: Any, exporter: str):
    policies_requests: PoliciesRequests = context.policies_requests
    diagnosis = {
        "name": "global metrics_collector",
        "enabled": True,
        "export": exporter,
        "config": {"metrics_collector": {}},
    }
    policies_requests.globals.diagnosis.append(diagnosis)

@when(
    "policies.yaml includes a global metrics_collector diagnosis with {exporter} as exporter and custom counter for {response_header} response header"
)
def step_impl(context: Any, exporter: str, response_header: str):
    policies_requests: PoliciesRequests = context.policies_requests
    diagnosis = {
        "name": "global metrics_collector",
        "enabled": True,
        "export": exporter,
        "config": {
            "metrics_collector": {
                "counters": [
                    {
                        "name_suffix": response_header,
                        "payload": "response_headers",
                        "key": response_header
                    }
                ]
            }
        },
    }
    policies_requests.globals.diagnosis.append(diagnosis)


@then("Transaction metrics are written")
@async_run_until_complete
async def step_impl(context: Any):
    content_bytes = _minio_client_helper.get_object_content_of_last_modified_object(
        LUNAR_BUCKET_NAME, retries=20
    )
    assert content_bytes is not None
    content = content_bytes.decode()
    collected_metrics = _read_last_collected_metrics(content)

    print("content is: " + content)
    context.collected_metrics = collected_metrics


@then("Traffic Metrics status should be {status_code:Int}")
@async_run_until_complete
async def step_impl(context: Any, status_code: int):
    assert context.collected_metrics["status_code"] == status_code


@then("Traffic Metrics normalized_url should be {url}")
@async_run_until_complete
async def step_impl(context: Any, url: str):
    assert context.collected_metrics["normalized_url"] == url


@then("Traffic Metrics method should be {method}")
@async_run_until_complete
async def step_impl(context: Any, method: str):
    assert context.collected_metrics["method"] == method

@then("There are {count:Int} lunar_transaction histograms on Prometheus Metric Server")
@async_run_until_complete
async def step_impl(context: Any, count: int):
    url = f"http://localhost:{PROMETHEUS_METRIC_SERVER_PORT}{PROMETHEUS_METRICS_ROUTE}"
    async with ClientSession() as session:
        try:
            async with session.get(url=url) as resp:
                assert resp.status == 200
                raw_metrics = await resp.text()
        except Exception as ex:
            print(f"failed calling metrics server: {ex}")
            assert False

    print("raw metrics:")
    print(raw_metrics)
    print("***")
    metrics = text_string_to_metric_families(raw_metrics)

    for metric in list(metrics):
        if metric.name == _LUNAR_TRANSACTION_HISTOGRAM_METRIC_NAME:
            matched_metric = metric
            break

    counts = [
        sample
        for sample in matched_metric.samples
        if sample.name.endswith(_HISTOGRAM_COUNT_SUFFIX)
    ]

    context.histogram_metric = matched_metric
    assert len(counts) == count


@then(
    "There is a histogram of status {code}, normalized_url {normalized_url} with {expected_count:Int} calls"
)
@async_run_until_complete
async def step_impl(context: Any, code: str, normalized_url: str, expected_count: int):
    histogram_metric: Metric = context.histogram_metric
    for sample in histogram_metric.samples:
        if (
            sample.name.endswith(_HISTOGRAM_COUNT_SUFFIX)
            and sample.labels.get("status_code") == code
            and sample.labels.get("normalized_url") == normalized_url
        ):
            matched_sample = sample
            break

    assert matched_sample.value == float(expected_count)

@then("There is a counter named {name} with the value {expected_value:Int}")
@async_run_until_complete
async def step_impl(context: Any, name: str, expected_value: int):
    url = f"http://localhost:{PROMETHEUS_METRIC_SERVER_PORT}{PROMETHEUS_METRICS_ROUTE}"
    async with ClientSession() as session:
        try:
            async with session.get(url=url) as resp:
                assert resp.status == 200
                raw_metrics = await resp.text()
        except Exception as ex:
            print(f"failed calling metrics server: {ex}")
            assert False

    print("raw metrics:")
    print(raw_metrics)
    print("***")
    print("Parsing metrics...")
    metrics = text_string_to_metric_families(raw_metrics)
    print("Successfully parsed metrics")
    for metric in list(metrics):
        if metric.name == name.rstrip(_COUNTER_SUFFIX):
            matched_metric = metric
            break

    print("***")
    print(matched_metric)
    print("***")
    counter: Metric = matched_metric.samples[0]
    assert counter.value == float(expected_value)


def _read_last_collected_metrics(content: str | None) -> dict[str, Any]:
    if content is None:
        return {}
    collected_metrics_data = content.splitlines()
    assert len(collected_metrics_data) > 0
    raw_collected_metrics = collected_metrics_data[-1]
    return json.loads(raw_collected_metrics)
