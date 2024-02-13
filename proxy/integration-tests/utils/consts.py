from enum import Enum
from json import dumps, loads
from toolkit_testing.integration_tests.mox import MoxEndpointRequest

LUNAR_PROXY_SERVICE_NAME = "lunar-proxy"
LUNAR_PROXY_PRO_1_SERVICE_NAME = "lunar-proxy-pro-1"
LUNAR_PROXY_PRO_2_SERVICE_NAME = "lunar-proxy-pro-2"
DEFAULT_LUNAR_PROXY_ID = "0"
MOX_SERVICE_NAME = "mox"
MINIO_SERVICE_NAME = "minio"
HTTPBIN_SERVICE_NAME = "httpbinmock"
ERROR_HEADER_KEY = "x-lunar-error"
LUNAR_REDIS_SERVICE_NAME = "lunar-redis"
LUNAR_HUB_MOCK_SERVICE_NAME = "hub-mock"

POLICIES_DIRECTORY = "/etc/lunar-proxy"

AGGREGATIONS_DIRECTORY = "/etc/fluent-bit/plugin"
REMEDY_STATS_FILE = "remedy-aggregated-state.json"


class PoliciesFilename(Enum):
    ACTUAL_POLICIES_FILENAME = "policies.yaml"
    INITIAL_POLICIES_FILENAME = "initial_policies.yaml"


ENGINE_ADMIN_PORT = 8081
ENGINE_1_ADMIN_PORT = 8082
RELOAD_POLICIES_PATH = "/apply_policies"

PROMETHEUS_METRIC_SERVER_PORT = 3000
PROMETHEUS_METRICS_ROUTE = "/metrics"

LUNAR_BUCKET_NAME = "lunar-proxy-bucket"
LUNAR_OTHER_BUCKET_NAME = "lunar-proxy-other-bucket"
AWS_ACCESS_KEY_ID = "LunarProxyAccessKeyID"
AWS_SECRET_ACCESS_KEY = "LunarProxySecretAccessKey"

HEALTHCHECK_RETRIES = 10

_MOX_GET_UUID_ENDPOINT_RESPONSE = dumps(loads('{"uuid": "fake_uuid_from_mox"}'))
_MOX_GET_UUID_ENDPOINT_STATUS = 200

MOX_GET_UUID_ENDPOINT_REQUEST = MoxEndpointRequest(
    verb="GET",
    path="/uuid",
    return_value=_MOX_GET_UUID_ENDPOINT_RESPONSE,
    status_code=_MOX_GET_UUID_ENDPOINT_STATUS,
    headers={},
)

MOX_GET_UNMATCHED_ENDPOINT_REQUEST = MoxEndpointRequest(
    verb="GET",
    path="/unmatched/path",
    return_value=_MOX_GET_UUID_ENDPOINT_RESPONSE,
    status_code=_MOX_GET_UUID_ENDPOINT_STATUS,
    headers={},
)

_MOX_THROTTLE_ENDPOINT_RESPONSE = dumps({"request_id": "<%= params['request_id'] %>"})
_MOX_GET_THROTTLE_OK_ENDPOINT_STATUS = 200

MOX_GET_THROTTLE_OK_ENDPOINT_REQUEST = MoxEndpointRequest(
    verb="GET",
    path="/throttle",
    return_value=_MOX_THROTTLE_ENDPOINT_RESPONSE,
    status_code=_MOX_GET_THROTTLE_OK_ENDPOINT_STATUS,
    headers={},
)

RETRY_AFTER_TIME = 1
_MOX_GET_THROTTLE_ERROR_STATUS = 429

MOX_GET_THROTTLE_ERROR_REQUEST = MoxEndpointRequest(
    verb="GET",
    path="/throttle",
    return_value=_MOX_THROTTLE_ENDPOINT_RESPONSE,
    status_code=_MOX_GET_THROTTLE_ERROR_STATUS,
    headers={"Retry-After": f"{RETRY_AFTER_TIME}"},
)
